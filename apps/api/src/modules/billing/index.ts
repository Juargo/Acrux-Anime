import type { Response } from 'express';
import { z } from 'zod';
import type { ErrorReporter } from '../../http/error-reporter.js';
import { ProblemError } from '../../http/problem.js';
import type { Module } from '../../http/routes.js';
import type { Session } from '../../http/session.js';
import type { CheckoutPort } from './adapters/lemon-squeezy-checkout.js';
import { InvalidOrderEvent, readOrderEvent } from './domain/order-event.js';
import { hasValidSignature } from './domain/signature.js';
import type { ApplyResult, EntitlementRepository } from './repositories/entitlement.repository.js';

// Lifetime Plus with Lemon Squeezy (epic #50, ADR-0025, ADR-0036). Billing is off until
// every LEMON_SQUEEZY_* variable is set: then the routes answer 503 and charge nothing.
export interface BillingDependencies {
  entitlements: EntitlementRepository;
  checkout: CheckoutPort;
  // Where Lemon Squeezy sends the buyer back after paying.
  returnUrl: string;
  // Signs every webhook; set per environment (ADR-0025).
  webhookSecret: string;
  // Only orders of this store and this variant are Plus.
  storeId: string;
  variantId: string;
  errorReporter?: ErrorReporter;
}

const webhookResult = z.object({
  result: z.enum(['applied', 'duplicate', 'unknown_user', 'refunded', 'ignored']),
});

const unavailable = { description: 'Billing is not enabled in this environment' };

function start(billing: BillingDependencies | undefined, response: Response): BillingDependencies {
  response.set('Cache-Control', 'no-store');
  if (!billing) {
    throw new ProblemError(503, 'billing.unavailable', 'Billing is not available');
  }
  return billing;
}

export function createBillingModule(billing: BillingDependencies | undefined): Module {
  return {
    name: 'billing',
    routes: [
      {
        method: 'post',
        path: '/api/v1/billing/checkout',
        rateLimit: 'write',
        docs: {
          summary: 'Start buying lifetime Plus; the checkout carries the session user id',
          responses: {
            200: {
              description: 'The Lemon Squeezy checkout page to open',
              schema: z.object({ url: z.url() }),
            },
            409: { description: 'The user already has Plus' },
            502: { description: 'Lemon Squeezy did not create the checkout; retry' },
            503: unavailable,
          },
        },
        handler: async (_request, response) => {
          const { entitlements, checkout, returnUrl, errorReporter } = start(billing, response);
          // The user comes from the session; the request body is never read (S10).
          const { userId } = response.locals.session as Session;
          if ((await entitlements.planOf(userId)) === 'plus') {
            throw new ProblemError(409, 'billing.already_plus', 'You already have Plus');
          }
          let url: string;
          try {
            url = await checkout.create({ userId, redirectUrl: `${returnUrl}?compra=lista` });
          } catch (error) {
            const requestId: string = response.locals.requestId;
            await errorReporter?.report(error, { requestId }).catch(() => {});
            throw new ProblemError(502, 'billing.provider_error', 'The checkout could not start');
          }
          response.json({ url });
        },
      },
      {
        method: 'post',
        path: '/api/v1/webhooks/lemon-squeezy',
        // Lemon Squeezy calls it without a session; the HMAC signature authenticates it.
        public: true,
        docs: {
          summary: 'Lemon Squeezy order events: a paid order grants Plus, a refund takes it back',
          responses: {
            200: {
              description: 'Received; a repeated event is not applied again',
              schema: webhookResult,
            },
            400: { description: 'The signed body is not a valid order event' },
            401: { description: 'Missing or invalid X-Signature' },
            503: unavailable,
          },
        },
        handler: async (request, response) => {
          const { entitlements, webhookSecret, storeId, variantId } = start(billing, response);
          const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
          if (!hasValidSignature(rawBody, request.get('X-Signature'), webhookSecret)) {
            throw new ProblemError(401, 'billing.invalid_signature', 'Invalid signature');
          }
          let action: ReturnType<typeof readOrderEvent>;
          try {
            action = readOrderEvent(JSON.parse(rawBody.toString('utf8')), { storeId, variantId });
          } catch (error) {
            if (error instanceof SyntaxError || error instanceof InvalidOrderEvent) {
              throw new ProblemError(400, 'billing.invalid_payload', 'Invalid event');
            }
            throw error;
          }
          let result: ApplyResult | 'ignored' = 'ignored';
          if (action.kind === 'grant') result = await entitlements.grantPlus(action.event);
          if (action.kind === 'revoke') result = await entitlements.revokePlus(action.event);
          response.json({ result });
        },
      },
    ],
  };
}
