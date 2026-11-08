import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';

export type UserPlan = 'free' | 'plus';

// What happened to a webhook event. "duplicate" means it was already processed (S9);
// "unknown_user" means the account no longer exists; "refunded" means the order's refund
// arrived first, so it grants nothing.
export type ApplyResult = 'applied' | 'duplicate' | 'unknown_user' | 'refunded';

export interface GrantPlus {
  // "<event name>:<order id>": Lemon Squeezy sends no event id of its own.
  eventId: string;
  eventName: string;
  userId: string;
  orderId: string;
  customerId: string;
  purchasedAt: Date;
}

export interface RevokePlus {
  eventId: string;
  eventName: string;
  orderId: string;
}

export interface EntitlementRepository {
  // Read from the database on every call: the plan never comes from the client (S10).
  planOf(userId: string): Promise<UserPlan>;
  grantPlus(event: GrantPlus): Promise<ApplyResult>;
  // Removes the entitlement only if this order granted it; the profile and its list stay.
  revokePlus(event: RevokePlus): Promise<ApplyResult>;
}

type Tx = Prisma.TransactionClient;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Records the event and applies it in one transaction (ADR-0022). The event's primary key
// makes a concurrent or repeated delivery fail the whole transaction, so it is applied once.
async function applyOnce(
  prisma: PrismaClient,
  event: { eventId: string; eventName: string },
  apply: (tx: Tx) => Promise<ApplyResult>,
): Promise<ApplyResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.billingEvent.create({
        data: { eventId: event.eventId, eventName: event.eventName },
      });
      return apply(tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) return 'duplicate';
    throw error;
  }
}

export function createEntitlementRepository(prisma: PrismaClient): EntitlementRepository {
  return {
    async planOf(userId) {
      const row = await prisma.entitlement.findUnique({
        where: { userId },
        select: { plan: true, validUntil: true },
      });
      if (!row) return 'free';
      // Lifetime Plus has no end date.
      if (row.validUntil !== null && row.validUntil <= new Date()) return 'free';
      return 'plus';
    },

    grantPlus: (event) =>
      applyOnce(prisma, event, async (tx) => {
        const refund = await tx.billingEvent.findUnique({
          where: { eventId: `order_refunded:${event.orderId}` },
          select: { eventId: true },
        });
        if (refund) return 'refunded';
        const profile = await tx.profile.findUnique({
          where: { userId: event.userId },
          select: { userId: true },
        });
        if (!profile) return 'unknown_user';
        const fields = {
          plan: 'plus_lifetime' as const,
          validUntil: null,
          lemonSqueezyOrderId: event.orderId,
          lemonSqueezyCustomerId: event.customerId,
          purchasedAt: event.purchasedAt,
        };
        await tx.entitlement.upsert({
          where: { userId: event.userId },
          create: { userId: event.userId, ...fields },
          update: fields,
        });
        return 'applied';
      }),

    revokePlus: (event) =>
      applyOnce(prisma, event, async (tx) => {
        await tx.entitlement.deleteMany({ where: { lemonSqueezyOrderId: event.orderId } });
        return 'applied';
      }),
  };
}
