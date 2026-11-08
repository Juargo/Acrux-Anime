import { createHmac } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { SPY_FAMILY } from '../support/anilist.ts';
import { markSeen } from '../support/api.ts';
import { API_URL, LEMON_SQUEEZY } from '../support/env.ts';
import { expect, test } from '../support/fixtures.ts';

// Journeys of epic #50: lifetime Plus against the real API and Postgres. Lemon Squeezy is
// stood in for by the webhooks it would send, signed with the E2E secret.
let nextOrder = Math.floor(Date.now() / 1000);

function orderEvent(
  eventName: 'order_created' | 'order_refunded',
  orderId: string,
  userId: string,
) {
  return {
    meta: { event_name: eventName, custom_data: { user_id: userId } },
    data: {
      type: 'orders',
      id: orderId,
      attributes: {
        store_id: Number(LEMON_SQUEEZY.storeId),
        customer_id: 501,
        status: eventName === 'order_created' ? 'paid' : 'refunded',
        refunded: eventName === 'order_refunded',
        first_order_item: { variant_id: Number(LEMON_SQUEEZY.variantId) },
        created_at: '2026-11-08T12:00:00.000000Z',
      },
    },
  };
}

async function deliver(request: APIRequestContext, payload: unknown, secret?: string) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret ?? LEMON_SQUEEZY.webhookSecret)
    .update(body)
    .digest('hex');
  return request.post(`${API_URL}/api/v1/webhooks/lemon-squeezy`, {
    headers: { 'Content-Type': 'application/json', 'X-Signature': signature },
    data: body,
  });
}

test('@CA-RF57-04 @CA-RF56-01 a paid order shows Plus in Perfil, and a refund takes it back but keeps the list', async ({
  page,
  request,
  signedIn: user,
}) => {
  await markSeen(request, user, [SPY_FAMILY.rootId]);
  const orderId = String(nextOrder++);

  await page.goto('/perfil');
  await expect(page.getByRole('link', { name: /Acrux Plus/ })).toContainText('Gratis');

  const paid = await deliver(request, orderEvent('order_created', orderId, user.id));
  expect(await paid.json()).toEqual({ result: 'applied' });

  await page.goto('/perfil');
  const row = page.getByRole('link', { name: /Acrux Plus/ });
  await expect(row).toContainText('Activo');
  await row.click();
  const plus = page.getByRole('region', { name: 'Acrux Plus' });
  await expect(plus.getByText('Plus vitalicio')).toBeVisible();
  await expect(plus.getByRole('button', { name: 'Comprar Plus' })).toHaveCount(0);

  const refund = await deliver(request, orderEvent('order_refunded', orderId, user.id));
  expect(await refund.json()).toEqual({ result: 'applied' });

  await page.reload();
  await expect(plus.getByRole('button', { name: 'Comprar Plus' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Contador total' })).toContainText('1 anime');
});

test('@CA-RF50-03 @CA-RF50-04 a repeated order applies once and a forged one gives nothing', async ({
  request,
  signedIn: user,
}) => {
  const orderId = String(nextOrder++);
  const event = orderEvent('order_created', orderId, user.id);

  const forged = await deliver(request, event, 'not-the-webhook-secret-000');
  expect(forged.status()).toBe(401);
  const before = await request.get(`${API_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  expect((await before.json()).plan).toBe('free');

  expect(await (await deliver(request, event)).json()).toEqual({ result: 'applied' });
  expect(await (await deliver(request, event)).json()).toEqual({ result: 'duplicate' });
  const after = await request.get(`${API_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${user.token}` },
  });
  expect(await after.json()).toMatchObject({ plan: 'plus', plusAvailable: true });
});
