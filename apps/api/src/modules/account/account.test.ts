import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import { createPrismaClient } from '../../db/client.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { ErrorReporter } from '../../http/error-reporter.js';
import { createMarksRepository } from '../marks/repositories/marks.repository.js';
import { createMarksService } from '../marks/services/marks.service.js';
import { createProfileRepository } from '../profile/repositories/profile.repository.js';
import { createProfileService } from '../profile/services/profile.service.js';
import { createAccountService } from './services/account.service.js';

// Runs against the real migrations, connected as acrux_api like the API in production.
// Neon Auth and PostHog are fakes that record what they were asked to delete.
const apiDir = fileURLToPath(new URL('../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

const USER = '7c1c2a3e-8b7d-4c1e-9a2f-0000000000c1';
const OTHER = '7c1c2a3e-8b7d-4c1e-9a2f-0000000000c2';
const auth = { Authorization: 'Bearer token' };

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

function setup(options: { neonFails?: boolean; posthogFails?: boolean; neon?: boolean } = {}) {
  const deleted = { neon: [] as string[], posthog: [] as string[] };
  const reported: unknown[] = [];
  const profileService = createProfileService(createProfileRepository(prisma));
  const marksService = createMarksService(createMarksRepository(prisma), profileService);
  const accountService = createAccountService({
    profiles: profileService,
    marks: marksService,
    directory:
      options.neon === false
        ? undefined
        : {
            deleteUser: async (userId) => {
              if (options.neonFails) throw new Error('Neon Auth answered 500');
              deleted.neon.push(userId);
            },
          },
    persons: {
      deletePerson: async (distinctId) => {
        if (options.posthogFails) throw new Error('PostHog answered 500');
        deleted.posthog.push(distinctId);
      },
    },
    analyticsIdOf: (userId) => `salted-${userId.slice(-2)}`,
  });
  const errorReporter: ErrorReporter = {
    report: async (error) => {
      reported.push(error);
    },
  };
  const base = createContainer({});
  const app = createApp({
    ...base,
    logger: pino({ enabled: false }),
    errorReporter,
    sessionVerifier: async () => ({ userId: USER, name: 'Camila' }),
    modules: createModules(profileService, marksService, undefined, {
      service: accountService,
      errorReporter,
    }),
  });
  return { app, deleted, reported, marksService, profileService };
}

async function seed(userId: string, anilistUserId: number) {
  const { profileService, marksService } = setup();
  await profileService.me({ userId, name: userId === USER ? 'Camila' : 'Nami' });
  await marksService.put({ userId }, 10, { status: 'seen' });
  await marksService.put({ userId }, 20, { status: 'watching', malId: 5114 });
  await prisma.anilistLink.create({
    data: { userId, anilistUserId, accessTokenEncrypted: Buffer.from('secret') },
  });
}

beforeEach(async () => {
  await prisma.profile.deleteMany({});
  await seed(USER, 901);
  await seed(OTHER, 902);
});

describe('GET /api/v1/me/export', () => {
  it('downloads the profile and every mark as JSON, never cached', async () => {
    const response = await request(setup().app).get('/api/v1/me/export').set(auth);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['content-disposition']).toBe('attachment; filename="acrux-datos.json"');
    expect(response.body).toEqual({
      exportedAt: expect.any(String),
      profile: {
        displayName: 'Camila',
        avatarUrl: null,
        avatarPreset: null,
        locale: null,
        listVisibility: 'private',
        counterMode: 'franchise',
        handle: 'camila',
        shownTotal: null,
        shownMode: null,
        cardShared: false,
        badges: [],
        createdAt: expect.any(String),
      },
      marks: [
        { anilistId: 10, malId: null, status: 'seen', markedAt: expect.any(String) },
        { anilistId: 20, malId: 5114, status: 'watching', markedAt: expect.any(String) },
      ],
    });
  });

  it('requires a session', async () => {
    const response = await request(setup().app).get('/api/v1/me/export');
    expect(response.status).toBe(401);
  });
});

describe('DELETE /api/v1/me', () => {
  it('@CA-RF06-01 deletes the profile, the marks and the AniList link, then Neon Auth and PostHog', async () => {
    const { app, deleted } = setup();
    const response = await request(app).delete('/api/v1/me').set(auth);
    expect(response.status).toBe(204);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(await prisma.profile.count({ where: { userId: USER } })).toBe(0);
    expect(await prisma.mark.count({ where: { userId: USER } })).toBe(0);
    expect(await prisma.anilistLink.count({ where: { userId: USER } })).toBe(0);
    // Nobody else's data changes.
    expect(await prisma.profile.count({ where: { userId: OTHER } })).toBe(1);
    expect(await prisma.mark.count({ where: { userId: OTHER } })).toBe(2);
    expect(await prisma.anilistLink.count({ where: { userId: OTHER } })).toBe(1);
    // Signing in with that user is no longer possible, and PostHog forgets the person.
    expect(deleted).toEqual({ neon: [USER], posthog: ['salted-c1'] });
  });

  it('answers 502 when Neon Auth fails, after deleting the data, and a retry finishes', async () => {
    const failing = setup({ neonFails: true });
    const response = await request(failing.app).delete('/api/v1/me').set(auth);
    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({ code: 'account.auth_unavailable' });
    expect(failing.reported).toHaveLength(1);
    expect(await prisma.profile.count({ where: { userId: USER } })).toBe(0);
    expect(failing.deleted.posthog).toEqual([]);

    const retry = setup();
    expect((await request(retry.app).delete('/api/v1/me').set(auth)).status).toBe(204);
    expect(retry.deleted).toEqual({ neon: [USER], posthog: ['salted-c1'] });
  });

  it('still deletes the account when PostHog fails, and reports it', async () => {
    const { app, deleted, reported } = setup({ posthogFails: true });
    const response = await request(app).delete('/api/v1/me').set(auth);
    expect(response.status).toBe(204);
    expect(deleted.neon).toEqual([USER]);
    expect(reported).toHaveLength(1);
  });

  it('answers 503 and deletes nothing without the Neon credentials', async () => {
    const { app } = setup({ neon: false });
    const response = await request(app).delete('/api/v1/me').set(auth);
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'account.unavailable' });
    expect(await prisma.profile.count({ where: { userId: USER } })).toBe(1);
    expect(await prisma.mark.count({ where: { userId: USER } })).toBe(2);
  });

  it('requires a session', async () => {
    const response = await request(setup().app).delete('/api/v1/me');
    expect(response.status).toBe(401);
  });
});
