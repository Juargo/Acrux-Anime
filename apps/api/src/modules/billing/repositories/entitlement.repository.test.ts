import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../../db/client.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { createProfileRepository } from '../../profile/repositories/profile.repository.js';
import { createEntitlementRepository } from './entitlement.repository.js';

// Runs against the real migrations, connected as acrux_api like the API in production.
const apiDir = fileURLToPath(new URL('../../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL_UNPOOLED: container.getConnectionUri() },
    stdio: 'pipe',
  });
  const owner = new pg.Client({ connectionString: container.getConnectionUri() });
  await owner.connect();
  await owner.query(`ALTER ROLE acrux_api WITH LOGIN PASSWORD 'api-test'`);
  await owner.end();
  const url = new URL(container.getConnectionUri());
  url.username = 'acrux_api';
  url.password = 'api-test';
  prisma = createPrismaClient(url.toString());
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

let next = 0;
async function newUser(): Promise<string> {
  next += 1;
  const userId = `9b1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e${String(next).padStart(4, '0')}`;
  await createProfileRepository(prisma).findOrCreate(userId, {
    displayName: 'Nami',
    avatarUrl: null,
  });
  return userId;
}

const purchasedAt = new Date('2026-11-08T12:00:00.000Z');

describe('entitlement repository', () => {
  it('reports a user without a purchase as free', async () => {
    const userId = await newUser();
    expect(await createEntitlementRepository(prisma).planOf(userId)).toBe('free');
  });

  it('grants lifetime Plus with the order, the customer and the purchase date', async () => {
    const entitlements = createEntitlementRepository(prisma);
    const userId = await newUser();

    const result = await entitlements.grantPlus({
      eventId: 'order_created:1001',
      eventName: 'order_created',
      userId,
      orderId: '1001',
      customerId: '501',
      purchasedAt,
    });

    expect(result).toBe('applied');
    expect(await entitlements.planOf(userId)).toBe('plus');
    const row = await prisma.entitlement.findUniqueOrThrow({ where: { userId } });
    expect(row).toMatchObject({
      plan: 'plus_lifetime',
      validUntil: null,
      lemonSqueezyOrderId: '1001',
      lemonSqueezyCustomerId: '501',
      purchasedAt,
    });
    expect(await prisma.billingEvent.count({ where: { eventId: 'order_created:1001' } })).toBe(1);
  });

  it('applies a repeated event only once (S9)', async () => {
    const entitlements = createEntitlementRepository(prisma);
    const userId = await newUser();
    const event = {
      eventId: 'order_created:1002',
      eventName: 'order_created',
      userId,
      orderId: '1002',
      customerId: '502',
      purchasedAt,
    };

    expect(await entitlements.grantPlus(event)).toBe('applied');
    const first = await prisma.entitlement.findUniqueOrThrow({ where: { userId } });
    expect(await entitlements.grantPlus(event)).toBe('duplicate');

    expect(await prisma.entitlement.count({ where: { userId } })).toBe(1);
    const second = await prisma.entitlement.findUniqueOrThrow({ where: { userId } });
    expect(second.updatedAt).toEqual(first.updatedAt);
    expect(await prisma.billingEvent.count({ where: { eventId: event.eventId } })).toBe(1);
  });

  it('records but does not grant an order for a deleted account', async () => {
    const entitlements = createEntitlementRepository(prisma);
    const userId = '9b1c2a3e-8b7d-4c1e-9a2f-0d3b4c5effff';

    const result = await entitlements.grantPlus({
      eventId: 'order_created:1003',
      eventName: 'order_created',
      userId,
      orderId: '1003',
      customerId: '503',
      purchasedAt,
    });

    expect(result).toBe('unknown_user');
    expect(await prisma.entitlement.count({ where: { userId } })).toBe(0);
    expect(await prisma.billingEvent.count({ where: { eventId: 'order_created:1003' } })).toBe(1);
  });

  it('@CA-RF56-01 takes Plus back on a refund and keeps the profile and its marks (S4)', async () => {
    const entitlements = createEntitlementRepository(prisma);
    const userId = await newUser();
    await prisma.mark.create({ data: { userId, animeId: 21, status: 'seen' } });
    await entitlements.grantPlus({
      eventId: 'order_created:1004',
      eventName: 'order_created',
      userId,
      orderId: '1004',
      customerId: '504',
      purchasedAt,
    });

    const result = await entitlements.revokePlus({
      eventId: 'order_refunded:1004',
      eventName: 'order_refunded',
      orderId: '1004',
    });

    expect(result).toBe('applied');
    expect(await entitlements.planOf(userId)).toBe('free');
    expect(await prisma.profile.count({ where: { userId } })).toBe(1);
    expect(await prisma.mark.count({ where: { userId } })).toBe(1);
    expect(
      await entitlements.revokePlus({
        eventId: 'order_refunded:1004',
        eventName: 'order_refunded',
        orderId: '1004',
      }),
    ).toBe('duplicate');
  });

  it("does not take Plus from someone else's order", async () => {
    const entitlements = createEntitlementRepository(prisma);
    const userId = await newUser();
    await entitlements.grantPlus({
      eventId: 'order_created:1005',
      eventName: 'order_created',
      userId,
      orderId: '1005',
      customerId: '505',
      purchasedAt,
    });

    await entitlements.revokePlus({
      eventId: 'order_refunded:9999',
      eventName: 'order_refunded',
      orderId: '9999',
    });

    expect(await entitlements.planOf(userId)).toBe('plus');
  });

  it('does not grant an order whose refund arrived first', async () => {
    const entitlements = createEntitlementRepository(prisma);
    const userId = await newUser();
    await entitlements.revokePlus({
      eventId: 'order_refunded:1006',
      eventName: 'order_refunded',
      orderId: '1006',
    });

    const result = await entitlements.grantPlus({
      eventId: 'order_created:1006',
      eventName: 'order_created',
      userId,
      orderId: '1006',
      customerId: '506',
      purchasedAt,
    });

    expect(result).toBe('refunded');
    expect(await entitlements.planOf(userId)).toBe('free');
  });
});
