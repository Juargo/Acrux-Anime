import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import type { CheckoutPort } from './adapters/lemon-squeezy-checkout.js';
import type { BillingDependencies } from './index.js';
import type {
  ApplyResult,
  EntitlementRepository,
  GrantPlus,
  RevokePlus,
  UserPlan,
} from './repositories/entitlement.repository.js';

// Lifetime Plus with Lemon Squeezy (epic #50). The plan always comes from the database.
const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const CHECKOUT_URL = 'https://acrux.lemonsqueezy.com/checkout/custom/abc?signature=x';
const RETURN_URL = 'https://app.acruxanime.com/perfil/plus';
const bearer = ['Authorization', 'Bearer token'] as const;

function fakeEntitlements(plans: Record<string, UserPlan> = {}) {
  const grants: GrantPlus[] = [];
  const revokes: RevokePlus[] = [];
  const results: { grant: ApplyResult; revoke: ApplyResult } = {
    grant: 'applied',
    revoke: 'applied',
  };
  const repository: EntitlementRepository = {
    planOf: async (userId) => plans[userId] ?? 'free',
    grantPlus: async (event) => {
      grants.push(event);
      return results.grant;
    },
    revokePlus: async (event) => {
      revokes.push(event);
      return results.revoke;
    },
  };
  return { repository, grants, revokes, results };
}

function fakeCheckout(fail = false) {
  const calls: { userId: string; redirectUrl: string }[] = [];
  const checkout: CheckoutPort = {
    create: async (input) => {
      calls.push(input);
      if (fail) throw new Error('Lemon Squeezy answered 500');
      return CHECKOUT_URL;
    },
  };
  return { checkout, calls };
}

function appWith(billing: BillingDependencies | undefined) {
  const base = createContainer({});
  return createApp({
    ...base,
    sessionVerifier: async () => ({ userId: USER }),
    modules: createModules(undefined, undefined, undefined, undefined, undefined, billing),
  });
}

describe('POST /api/v1/billing/checkout', () => {
  it("creates the checkout with the user's id and returns its URL (S2)", async () => {
    const { repository } = fakeEntitlements();
    const { checkout, calls } = fakeCheckout();

    const response = await request(
      appWith({ entitlements: repository, checkout, returnUrl: RETURN_URL }),
    )
      .post('/api/v1/billing/checkout')
      .set(...bearer);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: CHECKOUT_URL });
    expect(calls).toEqual([{ userId: USER, redirectUrl: `${RETURN_URL}?compra=lista` }]);
  });

  it('ignores a user id sent by the client (S10)', async () => {
    const { repository } = fakeEntitlements();
    const { checkout, calls } = fakeCheckout();

    await request(appWith({ entitlements: repository, checkout, returnUrl: RETURN_URL }))
      .post('/api/v1/billing/checkout')
      .set(...bearer)
      .send({ userId: '00000000-0000-4000-8000-000000000000' });

    expect(calls[0]?.userId).toBe(USER);
  });

  it('refuses a second purchase to a user who already has Plus', async () => {
    const { repository } = fakeEntitlements({ [USER]: 'plus' });
    const { checkout, calls } = fakeCheckout();

    const response = await request(
      appWith({ entitlements: repository, checkout, returnUrl: RETURN_URL }),
    )
      .post('/api/v1/billing/checkout')
      .set(...bearer);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('billing.already_plus');
    expect(calls).toEqual([]);
  });

  it('answers 503 while billing is off, so nothing can be charged (S11)', async () => {
    const response = await request(appWith(undefined))
      .post('/api/v1/billing/checkout')
      .set(...bearer);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('billing.unavailable');
  });

  it('needs a session', async () => {
    const { repository } = fakeEntitlements();
    const { checkout } = fakeCheckout();
    const response = await request(
      appWith({ entitlements: repository, checkout, returnUrl: RETURN_URL }),
    ).post('/api/v1/billing/checkout');
    expect(response.status).toBe(401);
  });

  it('answers 502 when Lemon Squeezy fails', async () => {
    const { repository } = fakeEntitlements();
    const { checkout } = fakeCheckout(true);

    const response = await request(
      appWith({ entitlements: repository, checkout, returnUrl: RETURN_URL }),
    )
      .post('/api/v1/billing/checkout')
      .set(...bearer);

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('billing.provider_error');
  });
});
