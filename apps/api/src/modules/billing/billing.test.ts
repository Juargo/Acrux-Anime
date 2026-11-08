import { createHmac } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import type { PlanReader } from '../../http/plan.js';
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

const SECRET = 'whsec-test-0123456789abcdef';
const STORE_ID = '11';
const VARIANT_ID = '22';

function deps(
  parts: Pick<BillingDependencies, 'entitlements'> & Partial<BillingDependencies>,
): BillingDependencies {
  return {
    checkout: fakeCheckout().checkout,
    returnUrl: RETURN_URL,
    webhookSecret: SECRET,
    storeId: STORE_ID,
    variantId: VARIANT_ID,
    ...parts,
  };
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

    const response = await request(appWith(deps({ entitlements: repository, checkout })))
      .post('/api/v1/billing/checkout')
      .set(...bearer);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: CHECKOUT_URL });
    expect(calls).toEqual([{ userId: USER, redirectUrl: `${RETURN_URL}?compra=lista` }]);
  });

  it('ignores a user id sent by the client (S10)', async () => {
    const { repository } = fakeEntitlements();
    const { checkout, calls } = fakeCheckout();

    await request(appWith(deps({ entitlements: repository, checkout })))
      .post('/api/v1/billing/checkout')
      .set(...bearer)
      .send({ userId: '00000000-0000-4000-8000-000000000000' });

    expect(calls[0]?.userId).toBe(USER);
  });

  it('refuses a second purchase to a user who already has Plus', async () => {
    const { repository } = fakeEntitlements({ [USER]: 'plus' });
    const { checkout, calls } = fakeCheckout();

    const response = await request(appWith(deps({ entitlements: repository, checkout })))
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
    const response = await request(appWith(deps({ entitlements: repository, checkout }))).post(
      '/api/v1/billing/checkout',
    );
    expect(response.status).toBe(401);
  });

  it('answers 502 when Lemon Squeezy fails', async () => {
    const { repository } = fakeEntitlements();
    const { checkout } = fakeCheckout(true);

    const response = await request(appWith(deps({ entitlements: repository, checkout })))
      .post('/api/v1/billing/checkout')
      .set(...bearer);

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('billing.provider_error');
  });
});

// A Lemon Squeezy order webhook, as https://docs.lemonsqueezy.com/help/webhooks/webhook-requests
// documents it, trimmed to the fields Acrux reads plus some it ignores.
function orderEvent(
  eventName: string,
  attributes: Record<string, unknown> = {},
  customData: Record<string, unknown> | null = { user_id: USER },
) {
  return {
    meta: { event_name: eventName, ...(customData ? { custom_data: customData } : {}) },
    data: {
      type: 'orders',
      id: '1001',
      attributes: {
        store_id: 11,
        customer_id: 501,
        identifier: '104e18a2-d755-4d4b-80c4-a6c1dcbe1c10',
        user_email: 'buyer@example.com',
        status: 'paid',
        refunded: false,
        total: 1999,
        first_order_item: { order_id: 1001, product_id: 7, variant_id: 22 },
        created_at: '2026-11-08T12:00:00.000000Z',
        ...attributes,
      },
    },
  };
}

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function deliver(app: ReturnType<typeof appWith>, payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  const call = request(app)
    .post('/api/v1/webhooks/lemon-squeezy')
    .set('Content-Type', 'application/json')
    .set('X-Event-Name', String((payload as { meta?: { event_name?: string } }).meta?.event_name));
  return (
    signature === undefined
      ? call.set('X-Signature', sign(body))
      : call.set('X-Signature', signature)
  ).send(body);
}

describe('POST /api/v1/webhooks/lemon-squeezy', () => {
  it('grants lifetime Plus for a paid order of the Plus variant (S3)', async () => {
    const { repository, grants } = fakeEntitlements();

    const response = await deliver(
      appWith(deps({ entitlements: repository })),
      orderEvent('order_created'),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: 'applied' });
    expect(grants).toEqual([
      {
        eventId: 'order_created:1001',
        eventName: 'order_created',
        userId: USER,
        orderId: '1001',
        customerId: '501',
        purchasedAt: new Date('2026-11-08T12:00:00.000Z'),
      },
    ]);
  });

  it('answers 200 to a repeated event without applying it again (S9)', async () => {
    const { repository, results } = fakeEntitlements();
    results.grant = 'duplicate';

    const response = await deliver(
      appWith(deps({ entitlements: repository })),
      orderEvent('order_created'),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: 'duplicate' });
  });

  it('rejects a bad signature before reading the event (S3)', async () => {
    const { repository, grants } = fakeEntitlements();
    const payload = orderEvent('order_created');

    const response = await deliver(
      appWith(deps({ entitlements: repository })),
      payload,
      sign(JSON.stringify(payload), 'another-secret-0123456789'),
    );

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('billing.invalid_signature');
    expect(grants).toEqual([]);
  });

  it('rejects a missing or malformed signature', async () => {
    const { repository, grants } = fakeEntitlements();
    const app = appWith(deps({ entitlements: repository }));

    expect((await deliver(app, orderEvent('order_created'), '')).status).toBe(401);
    expect((await deliver(app, orderEvent('order_created'), 'zz')).status).toBe(401);
    expect(grants).toEqual([]);
  });

  it('rejects a body changed after it was signed', async () => {
    const { repository, grants } = fakeEntitlements();
    const signed = JSON.stringify(orderEvent('order_created'));
    const tampered = JSON.stringify(
      orderEvent('order_created', {}, { user_id: '00000000-0000-4000-8000-000000000000' }),
    );

    const response = await request(appWith(deps({ entitlements: repository })))
      .post('/api/v1/webhooks/lemon-squeezy')
      .set('Content-Type', 'application/json')
      .set('X-Signature', sign(signed))
      .send(tampered);

    expect(response.status).toBe(401);
    expect(grants).toEqual([]);
  });

  it('rejects a signed body that is not a valid order event', async () => {
    const { repository, grants } = fakeEntitlements();
    const app = appWith(deps({ entitlements: repository }));

    const response = await deliver(app, { meta: { event_name: 'order_created' }, data: { id: 5 } });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('billing.invalid_payload');
    expect(grants).toEqual([]);
  });

  it.each([
    ['a pending order', { status: 'pending' }],
    ['a failed order', { status: 'failed' }],
    ['a fraudulent order', { status: 'fraudulent' }],
    ['another store', { store_id: 99 }],
    [
      'another product variant',
      { first_order_item: { order_id: 1001, product_id: 7, variant_id: 23 } },
    ],
  ])('grants nothing for %s', async (_case, attributes) => {
    const { repository, grants } = fakeEntitlements();

    const response = await deliver(
      appWith(deps({ entitlements: repository })),
      orderEvent('order_created', attributes),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: 'ignored' });
    expect(grants).toEqual([]);
  });

  it('grants nothing for an order without a valid user id', async () => {
    const { repository, grants } = fakeEntitlements();
    const app = appWith(deps({ entitlements: repository }));

    expect((await deliver(app, orderEvent('order_created', {}, null))).body).toEqual({
      result: 'ignored',
    });
    expect((await deliver(app, orderEvent('order_created', {}, { user_id: 'nami' }))).body).toEqual(
      { result: 'ignored' },
    );
    expect(grants).toEqual([]);
  });

  it('takes Plus back on a full refund (S4)', async () => {
    const { repository, revokes } = fakeEntitlements();

    const response = await deliver(
      appWith(deps({ entitlements: repository })),
      orderEvent('order_refunded', { status: 'refunded', refunded: true }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: 'applied' });
    expect(revokes).toEqual([
      { eventId: 'order_refunded:1001', eventName: 'order_refunded', orderId: '1001' },
    ]);
  });

  it('keeps Plus after a partial refund', async () => {
    const { repository, revokes } = fakeEntitlements();

    const response = await deliver(
      appWith(deps({ entitlements: repository })),
      orderEvent('order_refunded', { status: 'partial_refund', refunded: false }),
    );

    expect(response.body).toEqual({ result: 'ignored' });
    expect(revokes).toEqual([]);
  });

  it('accepts and ignores events Acrux does not use', async () => {
    const { repository, grants, revokes } = fakeEntitlements();

    const response = await deliver(
      appWith(deps({ entitlements: repository })),
      orderEvent('customer_updated'),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ result: 'ignored' });
    expect(grants).toEqual([]);
    expect(revokes).toEqual([]);
  });

  it('answers 503 while billing is off, so the provider retries later (S11)', async () => {
    const response = await deliver(appWith(undefined), orderEvent('order_created'));
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('billing.unavailable');
  });

  it('needs no session: the signature is the authentication', async () => {
    const { repository } = fakeEntitlements();
    const base = createContainer({});
    const app = createApp({
      ...base,
      sessionVerifier: async () => {
        throw new Error('no session expected');
      },
      modules: createModules(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        deps({ entitlements: repository }),
      ),
    });

    const response = await deliver(app, orderEvent('order_created'));

    expect(response.status).toBe(200);
  });
});

describe('GET /api/v1/me and Plus', () => {
  const profile = {
    displayName: 'Camila',
    avatarUrl: null,
    locale: null,
    listVisibility: 'private' as const,
    counterMode: 'franchise' as const,
    handle: 'camila',
    avatarPreset: null,
    shownTotal: null,
    shownMode: null,
    cardShared: false,
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
    analyticsId: null,
  };
  const profiles = {
    me: async () => profile,
    ensureProfile: async () => {},
    findByHandle: async () => null,
    remove: async () => false,
    update: async () => profile,
  };

  function meApp(planOf: PlanReader | undefined, billing: BillingDependencies | undefined) {
    const base = createContainer({});
    return createApp({
      ...base,
      sessionVerifier: async () => ({ userId: USER }),
      planOf,
      modules: createModules(profiles, undefined, undefined, undefined, undefined, billing, planOf),
    });
  }

  it('gives the plan read from the database on every device (S5)', async () => {
    const { repository } = fakeEntitlements({ [USER]: 'plus' });
    const app = meApp(repository.planOf, deps({ entitlements: repository }));

    const read = await request(app)
      .get('/api/v1/me')
      .set(...bearer);
    expect(read.body).toMatchObject({ plan: 'plus', plusAvailable: true });

    const patched = await request(app)
      .patch('/api/v1/me')
      .set(...bearer)
      .send({ counterMode: 'franchise' });
    expect(patched.body).toMatchObject({ plan: 'plus', plusAvailable: true });
  });

  it('keeps a bought Plus while billing is off, but offers no purchase (S11)', async () => {
    const { repository } = fakeEntitlements({ [USER]: 'plus' });
    const read = await request(meApp(repository.planOf, undefined))
      .get('/api/v1/me')
      .set(...bearer);
    expect(read.body).toMatchObject({ plan: 'plus', plusAvailable: false });
  });

  it('reports a free user without a database plan reader', async () => {
    const read = await request(meApp(undefined, undefined))
      .get('/api/v1/me')
      .set(...bearer);
    expect(read.body).toMatchObject({ plan: 'free', plusAvailable: false });
  });
});
