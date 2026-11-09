import { z } from 'zod';
import type { GrantPlus, RevokePlus } from '../repositories/entitlement.repository.js';

// The order webhook fields Acrux reads (ADR-0028: validated with Zod). Anything else in the
// payload, such as the buyer's email, is ignored and never stored or logged (ADR-0030).
const orderEventSchema = z.object({
  meta: z.object({
    event_name: z.string().min(1),
    custom_data: z.object({ user_id: z.unknown().optional() }).loose().nullish(),
  }),
  data: z.object({
    type: z.string(),
    id: z.string().regex(/^\d+$/),
    attributes: z
      .object({
        store_id: z.number().int(),
        customer_id: z.number().int(),
        status: z.string(),
        refunded: z.boolean(),
        created_at: z.string(),
        first_order_item: z.object({ variant_id: z.number().int() }).loose().nullish(),
      })
      .loose(),
  }),
});

export type OrderAction =
  | { kind: 'grant'; event: GrantPlus }
  | { kind: 'revoke'; event: RevokePlus }
  | { kind: 'ignore' };

export class InvalidOrderEvent extends Error {}

const uuid = z.uuid();

// Decides what a verified webhook means for Plus (A3): a paid order of the Plus variant
// grants it, a full refund takes it back, and everything else changes nothing.
export function readOrderEvent(
  payload: unknown,
  expected: { storeId: string; variantId: string },
): OrderAction {
  const parsed = orderEventSchema.safeParse(payload);
  if (!parsed.success) throw new InvalidOrderEvent('Invalid Lemon Squeezy event');
  const { meta, data } = parsed.data;
  const name = meta.event_name;
  if (name !== 'order_created' && name !== 'order_refunded') return { kind: 'ignore' };
  if (data.type !== 'orders') throw new InvalidOrderEvent('Invalid Lemon Squeezy event');

  const { attributes } = data;
  if (String(attributes.store_id) !== expected.storeId) return { kind: 'ignore' };
  if (String(attributes.first_order_item?.variant_id) !== expected.variantId) {
    return { kind: 'ignore' };
  }
  // Lemon Squeezy sends no event id: an order is created once and refunded once (A2).
  const eventId = `${name}:${data.id}`;

  if (name === 'order_refunded') {
    if (!attributes.refunded) return { kind: 'ignore' };
    return { kind: 'revoke', event: { eventId, eventName: name, orderId: data.id } };
  }

  if (attributes.status !== 'paid') return { kind: 'ignore' };
  const userId = uuid.safeParse(meta.custom_data?.user_id);
  if (!userId.success) return { kind: 'ignore' };
  const purchasedAt = new Date(attributes.created_at);
  if (Number.isNaN(purchasedAt.getTime())) throw new InvalidOrderEvent('Invalid order date');
  return {
    kind: 'grant',
    event: {
      eventId,
      eventName: name,
      userId: userId.data.toLowerCase(),
      orderId: data.id,
      customerId: String(attributes.customer_id),
      purchasedAt,
    },
  };
}
