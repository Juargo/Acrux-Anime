import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { createContainer, createModules } from '../../../container.js';
import { createPrismaClient } from '../../../db/client.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { createProfileRepository } from '../../profile/repositories/profile.repository.js';
import { createProfileService } from '../../profile/services/profile.service.js';
import { createMarksRepository } from '../repositories/marks.repository.js';
import { createMarksService, type MarksService } from './marks.service.js';

// Runs against the real migrations, connected as acrux_api like the API in production.
const apiDir = fileURLToPath(new URL('../../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let marks: MarksService;

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
  marks = createMarksService(
    createMarksRepository(prisma),
    createProfileService(createProfileRepository(prisma)),
  );
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

let next = 0;
function newUser() {
  next += 1;
  return { userId: `6f1c2a3e-8b7d-4c1e-9a2f-${String(next).padStart(12, '0')}`, name: 'Camila' };
}

describe('marks service on Postgres', () => {
  it('creates the profile on the first mark and stores the AniList and MAL ids', async () => {
    const user = newUser();
    const mark = await marks.put(user, 16498, { status: 'seen', malId: 16498 });
    expect(mark).toEqual({
      anilistId: 16498,
      malId: 16498,
      status: 'seen',
      markedAt: expect.any(Date),
    });
    expect(await prisma.profile.count({ where: { userId: user.userId } })).toBe(1);
    expect(await marks.list(user)).toEqual([mark]);
  });

  it('keeps markedAt when the same status is sent again and renews it on a new status', async () => {
    const user = newUser();
    const past = new Date('2020-01-01T00:00:00.000Z');
    await marks.put(user, 1, { status: 'watching' });
    await prisma.mark.update({
      where: { userId_anilistId: { userId: user.userId, anilistId: 1 } },
      data: { markedAt: past },
    });
    const again = await marks.put(user, 1, { status: 'watching' });
    expect(again.markedAt).toEqual(past);
    const seen = await marks.put(user, 1, { status: 'seen' });
    expect(seen.status).toBe('seen');
    expect(seen.markedAt.getTime()).toBeGreaterThan(past.getTime());
  });

  it('keeps the stored malId when it is omitted and clears it when it is null', async () => {
    const user = newUser();
    await marks.put(user, 2, { status: 'seen', malId: 22 });
    expect((await marks.put(user, 2, { status: 'seen' })).malId).toBe(22);
    expect((await marks.put(user, 2, { status: 'seen', malId: null })).malId).toBeNull();
  });

  it('lists the marks ordered by anilistId', async () => {
    const user = newUser();
    await marks.put(user, 30, { status: 'seen' });
    await marks.put(user, 4, { status: 'seen' });
    await marks.put(user, 17, { status: 'watching' });
    expect((await marks.list(user)).map((mark) => mark.anilistId)).toEqual([4, 17, 30]);
  });

  it('returns an empty list for a user without a profile', async () => {
    expect(await marks.list(newUser())).toEqual([]);
  });

  it('deletes a mark and deleting it again is not an error', async () => {
    const user = newUser();
    await marks.put(user, 5, { status: 'seen' });
    await marks.remove(user, 5);
    await marks.remove(user, 5);
    await marks.remove(newUser(), 5);
    expect(await marks.list(user)).toEqual([]);
  });

  it('@CA-RF20-01 marks every entry of a core as seen in one batch', async () => {
    const user = newUser();
    await marks.put(user, 20958, { status: 'watching' });
    const written = await marks.batch(user, {
      status: 'seen',
      entries: [{ anilistId: 16498, malId: 16498 }, { anilistId: 20958 }, { anilistId: 99147 }],
    });
    expect(written.map((mark) => [mark.anilistId, mark.status])).toEqual([
      [16498, 'seen'],
      [20958, 'seen'],
      [99147, 'seen'],
    ]);
    expect(written[0]?.malId).toBe(16498);
    expect(await marks.list(user)).toEqual(written);
  });

  it('keeps markedAt in a batch for entries that already had the same status', async () => {
    const user = newUser();
    const past = new Date('2020-01-01T00:00:00.000Z');
    await marks.batch(user, { status: 'seen', entries: [{ anilistId: 8 }, { anilistId: 18 }] });
    await prisma.mark.updateMany({ where: { userId: user.userId }, data: { markedAt: past } });
    const after = await marks.batch(user, {
      status: 'seen',
      entries: [{ anilistId: 8 }, { anilistId: 28 }],
    });
    expect(after[0]?.markedAt).toEqual(past);
    expect(after[1]?.markedAt.getTime()).toBeGreaterThan(past.getTime());
  });

  it('rolls back the whole batch when one entry fails', async () => {
    const user = newUser();
    await marks.put(user, 9, { status: 'watching' });
    // An id outside int4 makes Postgres reject the statement after the first entries.
    await expect(
      marks.batch(user, {
        status: 'seen',
        entries: [{ anilistId: 9 }, { anilistId: 10 }, { anilistId: 2 ** 40 }],
      }),
    ).rejects.toThrow();
    const list = await marks.list(user);
    expect(list.map((mark) => [mark.anilistId, mark.status])).toEqual([[9, 'watching']]);
  });

  it('removes only the listed marks with a null status', async () => {
    const user = newUser();
    await marks.batch(user, {
      status: 'seen',
      entries: [{ anilistId: 11 }, { anilistId: 12 }, { anilistId: 13 }],
    });
    expect(
      await marks.batch(user, { status: null, entries: [{ anilistId: 11 }, { anilistId: 12 }] }),
    ).toEqual([]);
    expect((await marks.list(user)).map((mark) => mark.anilistId)).toEqual([13]);
  });
});

describe('marks isolation between users (ADR-0029)', () => {
  const A = '6f1c2a3e-8b7d-4c1e-9a2f-0000000000aa';
  const B = '6f1c2a3e-8b7d-4c1e-9a2f-0000000000bb';

  function app() {
    const base = createContainer({});
    return createApp({
      ...base,
      logger: pino({ enabled: false }),
      marksService: marks,
      // The bearer token names the user, so each request acts as A or B.
      sessionVerifier: async (token) => ({ userId: token }),
      modules: createModules(undefined, marks),
    });
  }

  async function marksOf(userId: string) {
    return prisma.mark.findMany({ where: { userId }, orderBy: { anilistId: 'asc' } });
  }

  it('B cannot read the marks of A', async () => {
    await marks.put({ userId: A }, 100, { status: 'seen' });
    const response = await request(app())
      .get('/api/v1/me/marks')
      .set('Authorization', `Bearer ${B}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], nextCursor: null });
  });

  it('B deleting the anilistId of A leaves the mark of A intact', async () => {
    await marks.put({ userId: A }, 101, { status: 'seen' });
    const response = await request(app())
      .delete('/api/v1/me/marks/101')
      .set('Authorization', `Bearer ${B}`);
    expect(response.status).toBe(204);
    expect((await marksOf(A)).some((mark) => mark.anilistId === 101)).toBe(true);
  });

  it('B removing in batch the anilistIds of A leaves the marks of A intact', async () => {
    await marks.batch(
      { userId: A },
      { status: 'seen', entries: [{ anilistId: 102 }, { anilistId: 103 }] },
    );
    const response = await request(app())
      .post('/api/v1/me/marks:batch')
      .set('Authorization', `Bearer ${B}`)
      .send({ status: null, entries: [{ anilistId: 102 }, { anilistId: 103 }] });
    expect(response.status).toBe(200);
    const ofA = (await marksOf(A)).map((mark) => mark.anilistId);
    expect(ofA).toEqual(expect.arrayContaining([102, 103]));
  });

  it('B marking the anilistId of A creates a mark of B without changing the one of A', async () => {
    const ofA = await marks.put({ userId: A }, 104, { status: 'watching', malId: 4 });
    const response = await request(app())
      .put('/api/v1/me/marks/104')
      .set('Authorization', `Bearer ${B}`)
      .send({ status: 'seen' });
    expect(response.status).toBe(200);
    const stored = (await marksOf(A)).find((mark) => mark.anilistId === 104);
    expect(stored).toMatchObject({ status: 'watching', malId: 4, markedAt: ofA.markedAt });
    expect((await marksOf(B)).find((mark) => mark.anilistId === 104)).toMatchObject({
      status: 'seen',
      malId: null,
    });
  });
});
