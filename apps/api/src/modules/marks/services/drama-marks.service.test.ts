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
import { createDramaMarksRepository } from '../repositories/drama-marks.repository.js';
import { createMarksRepository } from '../repositories/marks.repository.js';
import { createDramaMarksService, type DramaMarksService } from './drama-marks.service.js';
import { createMarksService, type MarksService } from './marks.service.js';

// Runs against the real migrations, connected as acrux_api like the API in production.
// The dramas are written by the owner: the API can only read them.
const apiDir = fileURLToPath(new URL('../../../..', import.meta.url));
const DRAMAS = [201, 202, 203, 204, 205];
const UNKNOWN_DRAMA = 999;
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let dramaMarks: DramaMarksService;
let animeMarks: MarksService;

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
  for (const id of DRAMAS) {
    await owner.query(
      `INSERT INTO drama (id, title, search_text, tvmaze_url)
       VALUES ($1, $2, $3, $4)`,
      [id, `Show ${id}`, `show ${id}`, `https://www.tvmaze.com/shows/${id}/show`],
    );
  }
  await owner.end();
  const url = new URL(container.getConnectionUri());
  url.username = 'acrux_api';
  url.password = 'api-test';
  prisma = createPrismaClient(url.toString());
  const profiles = createProfileService(createProfileRepository(prisma));
  dramaMarks = createDramaMarksService(createDramaMarksRepository(prisma), profiles);
  animeMarks = createMarksService(createMarksRepository(prisma), profiles);
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

const all = { limit: 500 };

describe('drama marks service on Postgres (#154)', () => {
  it('creates the profile on the first mark and stores the whole show as seen', async () => {
    const session = newUser();
    const mark = await dramaMarks.put(session, 201, { status: 'seen' });
    expect(mark).toMatchObject({ dramaId: 201, status: 'seen' });
    expect(mark?.markedAt).toBeInstanceOf(Date);
    const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
    expect(profile?.displayName).toBe('Camila');
    expect(await prisma.dramaMark.count({ where: { userId: session.userId } })).toBe(1);
  });

  it('keeps markedAt when the same status is sent again and renews it on a new status', async () => {
    const session = newUser();
    const first = await dramaMarks.put(session, 201, { status: 'watching' });
    const again = await dramaMarks.put(session, 201, { status: 'watching' });
    expect(again?.markedAt).toEqual(first?.markedAt);
    const changed = await dramaMarks.put(session, 201, { status: 'seen' });
    expect(changed?.status).toBe('seen');
    expect(changed?.markedAt.getTime()).toBeGreaterThan(first?.markedAt.getTime() ?? Infinity);
    expect(await prisma.dramaMark.count({ where: { userId: session.userId } })).toBe(1);
  });

  it('does not mark a drama that is not in the catalog, and creates nothing', async () => {
    const session = newUser();
    expect(await dramaMarks.put(session, UNKNOWN_DRAMA, { status: 'seen' })).toBeNull();
    expect(await prisma.dramaMark.count({ where: { userId: session.userId } })).toBe(0);
  });

  it('lists the marks ordered by dramaId and pages them after the cursor', async () => {
    const session = newUser();
    for (const id of [203, 201, 202]) await dramaMarks.put(session, id, { status: 'seen' });
    const whole = await dramaMarks.list(session, all);
    expect(whole.items.map((mark) => mark.dramaId)).toEqual([201, 202, 203]);
    expect(whole.nextCursor).toBeNull();

    const first = await dramaMarks.list(session, { limit: 2 });
    expect(first.items.map((mark) => mark.dramaId)).toEqual([201, 202]);
    expect(first.nextCursor).toBe(202);
    const second = await dramaMarks.list(session, { after: 202, limit: 2 });
    expect(second.items.map((mark) => mark.dramaId)).toEqual([203]);
    expect(second.nextCursor).toBeNull();
  });

  it('returns an empty list for a user without a profile', async () => {
    expect(await dramaMarks.list(newUser(), all)).toEqual({ items: [], nextCursor: null });
  });

  it('deletes a mark and deleting it again is not an error', async () => {
    const session = newUser();
    await dramaMarks.put(session, 201, { status: 'seen' });
    await dramaMarks.put(session, 202, { status: 'seen' });
    await dramaMarks.remove(session, 201);
    await dramaMarks.remove(session, 201);
    expect((await dramaMarks.list(session, all)).items.map((mark) => mark.dramaId)).toEqual([202]);
  });

  // S6: «Las marcas de anime existentes quedan intactas». The ids overlap on purpose.
  it('leaves the anime marks as they are, even with the same id', async () => {
    const session = newUser();
    const anime = await animeMarks.put(session, 201, { status: 'watching' });
    await dramaMarks.put(session, 201, { status: 'seen' });
    await dramaMarks.remove(session, 201);
    const stored = await prisma.mark.findMany({ where: { userId: session.userId } });
    expect(stored).toEqual([
      { userId: session.userId, animeId: 201, status: 'watching', markedAt: anime.markedAt },
    ]);
  });

  it('leaves the drama marks as they are when the anime with the same id is unmarked', async () => {
    const session = newUser();
    await animeMarks.put(session, 202, { status: 'seen' });
    await dramaMarks.put(session, 202, { status: 'seen' });
    await animeMarks.remove(session, 202);
    expect((await dramaMarks.list(session, all)).items.map((mark) => mark.dramaId)).toEqual([202]);
  });
});

describe('drama marks over HTTP (#154)', () => {
  const A = '6f1c2a3e-8b7d-4c1e-9a2f-0000000000aa';
  const B = '6f1c2a3e-8b7d-4c1e-9a2f-0000000000bb';
  const as = (userId: string) => ({ Authorization: `Bearer ${userId}` });

  function app(options: { database: boolean } = { database: true }) {
    const base = createContainer({});
    return createApp({
      ...base,
      logger: pino({ enabled: false }),
      // The bearer token names the user, so each request acts as A or B.
      sessionVerifier: async (token) => ({ userId: token }),
      modules: createModules(
        undefined,
        animeMarks,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        options.database ? dramaMarks : undefined,
      ),
    });
  }

  it('marks, lists and unmarks a drama, never cached', async () => {
    const put = await request(app())
      .put('/api/v1/me/drama-marks/203')
      .set(as(A))
      .send({ status: 'watching' });
    expect(put.status).toBe(200);
    expect(put.headers['cache-control']).toBe('private, no-store');
    expect(put.body).toEqual({ dramaId: 203, status: 'watching', markedAt: expect.any(String) });

    const list = await request(app()).get('/api/v1/me/drama-marks').set(as(A));
    expect(list.status).toBe(200);
    expect(list.headers['cache-control']).toBe('private, no-store');
    expect(list.body).toEqual({ items: [put.body], nextCursor: null });

    const removed = await request(app()).delete('/api/v1/me/drama-marks/203').set(as(A));
    expect(removed.status).toBe(204);
    const after = await request(app()).get('/api/v1/me/drama-marks').set(as(A));
    expect(after.body).toEqual({ items: [], nextCursor: null });
  });

  it('pages the list with cursor and limit, the cursor as a string', async () => {
    await dramaMarks.put({ userId: A }, 204, { status: 'seen' });
    await dramaMarks.put({ userId: A }, 205, { status: 'seen' });
    const first = await request(app()).get('/api/v1/me/drama-marks?limit=1').set(as(A));
    expect(first.body.items.map((mark: { dramaId: number }) => mark.dramaId)).toEqual([204]);
    expect(first.body.nextCursor).toBe('204');
    const second = await request(app()).get('/api/v1/me/drama-marks?limit=1&cursor=204').set(as(A));
    expect(second.body.items.map((mark: { dramaId: number }) => mark.dramaId)).toEqual([205]);
    expect(second.body.nextCursor).toBeNull();
    expect((await request(app()).get('/api/v1/me/drama-marks?limit=0').set(as(A))).status).toBe(
      400,
    );
  });

  it('answers 404 for a drama that is not in the catalog', async () => {
    const response = await request(app())
      .put(`/api/v1/me/drama-marks/${UNKNOWN_DRAMA}`)
      .set(as(A))
      .send({ status: 'seen' });
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ code: 'drama_marks.unknown_drama' });
  });

  it.each(['0', '-1', 'abc', '1e3', '2147483648'])('rejects the dramaId %s', async (id) => {
    const put = await request(app())
      .put(`/api/v1/me/drama-marks/${id}`)
      .set(as(A))
      .send({ status: 'seen' });
    expect(put.status).toBe(400);
    expect(put.body).toMatchObject({ code: 'drama_marks.invalid_drama_id' });
    const removed = await request(app()).delete(`/api/v1/me/drama-marks/${id}`).set(as(A));
    expect(removed.status).toBe(400);
  });

  it.each([{}, { status: 'dropped' }, { status: 'seen', extra: true }])(
    'rejects the body %j',
    async (body) => {
      const response = await request(app()).put('/api/v1/me/drama-marks/201').set(as(A)).send(body);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'drama_marks.invalid_body' });
    },
  );

  it('requires a session', async () => {
    expect((await request(app()).get('/api/v1/me/drama-marks')).status).toBe(401);
    expect(
      (await request(app()).put('/api/v1/me/drama-marks/201').send({ status: 'seen' })).status,
    ).toBe(401);
    expect((await request(app()).delete('/api/v1/me/drama-marks/201')).status).toBe(401);
  });

  it('answers 503 without a database', async () => {
    const response = await request(app({ database: false }))
      .get('/api/v1/me/drama-marks')
      .set(as(A));
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'drama_marks.unavailable' });
  });

  // ADR-0029: every query takes the user from the session.
  it('B cannot read, change or delete the drama marks of A', async () => {
    const ofA = await dramaMarks.put({ userId: A }, 201, { status: 'watching' });
    const list = await request(app()).get('/api/v1/me/drama-marks').set(as(B));
    expect(list.body).toEqual({ items: [], nextCursor: null });

    await request(app()).put('/api/v1/me/drama-marks/201').set(as(B)).send({ status: 'seen' });
    await request(app()).delete('/api/v1/me/drama-marks/201').set(as(B));
    const stored = await prisma.dramaMark.findUnique({
      where: { userId_dramaId: { userId: A, dramaId: 201 } },
    });
    expect(stored).toMatchObject({ status: 'watching', markedAt: ofA?.markedAt });
    expect(await prisma.dramaMark.count({ where: { userId: B } })).toBe(0);
  });
});
