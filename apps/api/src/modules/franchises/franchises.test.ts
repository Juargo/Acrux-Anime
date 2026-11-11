import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import type { Session } from '../../http/session.js';
import type {
  FranchiseOverrideRow,
  FranchiseOverridesRepository,
} from './repositories/franchise-overrides.repository.js';

// The curator table (#42, RF-60): every signed-in user reads it, only the curator edits it.
const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const ATTACK_ON_TITAN = 16498;

function fakeRepository(rows: FranchiseOverrideRow[] = []) {
  const writes: unknown[] = [];
  const repository: FranchiseOverridesRepository = {
    list: async () => rows,
    upsert: async (row) => {
      writes.push(row);
      return { ...row, updatedAt: new Date('2026-11-07T12:00:00.000Z') };
    },
  };
  return { repository, writes };
}

function appAs(
  session: Omit<Session, 'userId'>,
  repository: FranchiseOverridesRepository | undefined,
) {
  const base = createContainer({});
  return createApp({
    ...base,
    sessionVerifier: async () => ({ userId: USER, ...session }),
    modules: createModules(undefined, undefined, undefined, undefined, repository),
  });
}

const curator = { roles: ['curator'] as const };
const bearer = ['Authorization', 'Bearer token'] as const;

describe('GET /api/v1/franchise-overrides', () => {
  it('gives anyone the table, ids only (RDI-15), visitors of a public profile included', async () => {
    const { repository } = fakeRepository([
      {
        animeId: 20811,
        franchiseRootId: ATTACK_ON_TITAN,
        role: 'extra',
        updatedAt: new Date('2026-11-01T10:00:00.000Z'),
      },
    ]);
    const response = await request(appAs({}, repository)).get('/api/v1/franchise-overrides');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    expect(response.body).toEqual({
      items: [
        {
          animeId: 20811,
          franchiseRootId: ATTACK_ON_TITAN,
          role: 'extra',
          updatedAt: '2026-11-01T10:00:00.000Z',
        },
      ],
    });
  });

  it('answers 503 when the database is not configured', async () => {
    const response = await request(appAs({}, undefined)).get('/api/v1/franchise-overrides');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'franchises.unavailable' });
  });
});

describe('PUT /api/v1/franchise-overrides/:animeId', () => {
  it('@CA-RF60-03 answers 403 to a user without the curator role and writes nothing', async () => {
    const { repository, writes } = fakeRepository();
    const response = await request(appAs({}, repository))
      .put('/api/v1/franchise-overrides/20811')
      .set(...bearer)
      .send({ franchiseRootId: ATTACK_ON_TITAN, role: 'extra' });
    expect(response.status).toBe(403);
    expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 403, code: 'auth.forbidden' });
    expect(writes).toEqual([]);
  });

  it('lets the curator save a correction and returns it with its new time (RF-60)', async () => {
    const { repository, writes } = fakeRepository();
    const response = await request(appAs(curator, repository))
      .put('/api/v1/franchise-overrides/20811')
      .set(...bearer)
      .send({ franchiseRootId: ATTACK_ON_TITAN, role: 'extra' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toEqual({
      animeId: 20811,
      franchiseRootId: ATTACK_ON_TITAN,
      role: 'extra',
      updatedAt: '2026-11-07T12:00:00.000Z',
    });
    expect(writes).toEqual([{ animeId: 20811, franchiseRootId: ATTACK_ON_TITAN, role: 'extra' }]);
  });

  it('accepts the three roles of the table', async () => {
    for (const role of ['core', 'extra', 'separate']) {
      const response = await request(appAs(curator, fakeRepository().repository))
        .put('/api/v1/franchise-overrides/20811')
        .set(...bearer)
        .send({ franchiseRootId: ATTACK_ON_TITAN, role });
      expect(response.status, role).toBe(200);
    }
  });

  it('rejects an invalid id or body without writing', async () => {
    const { repository, writes } = fakeRepository();
    const app = appAs(curator, repository);
    const cases = [
      ['0', { franchiseRootId: 1, role: 'core' }],
      ['1e3', { franchiseRootId: 1, role: 'core' }],
      ['20811', { franchiseRootId: 0, role: 'core' }],
      ['20811', { franchiseRootId: 1, role: 'main' }],
      ['20811', { franchiseRootId: 1 }],
      ['20811', { franchiseRootId: 1, role: 'core', title: 'Shingeki no Kyojin' }],
    ] as const;
    for (const [id, body] of cases) {
      const response = await request(app)
        .put(`/api/v1/franchise-overrides/${id}`)
        .set(...bearer)
        .send(body);
      expect(response.status, `${id} ${JSON.stringify(body)}`).toBe(400);
    }
    expect(writes).toEqual([]);
  });

  it('requires a session before the role', async () => {
    const response = await request(appAs(curator, fakeRepository().repository))
      .put('/api/v1/franchise-overrides/20811')
      .send({ franchiseRootId: ATTACK_ON_TITAN, role: 'extra' });
    expect(response.status).toBe(401);
  });

  it('has no delete: undoing a correction must not take from anyone (RF-60)', async () => {
    const response = await request(appAs(curator, fakeRepository().repository))
      .delete('/api/v1/franchise-overrides/20811')
      .set(...bearer);
    expect(response.status).toBe(404);
  });
});

describe('GET /api/v1/me', () => {
  it('tells the web whether the user is a curator', async () => {
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
      badges: [],
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
    for (const [session, expected] of [
      [{}, false],
      [curator, true],
    ] as const) {
      const base = createContainer({});
      const app = createApp({
        ...base,
        sessionVerifier: async () => ({ userId: USER, ...session }),
        modules: createModules(profiles, undefined),
      });
      const read = await request(app)
        .get('/api/v1/me')
        .set(...bearer);
      expect(read.body.curator).toBe(expected);
      const patched = await request(app)
        .patch('/api/v1/me')
        .set(...bearer)
        .send({ counterMode: 'franchise' });
      expect(patched.body.curator).toBe(expected);
    }
  });
});
