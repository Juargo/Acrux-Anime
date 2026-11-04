import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import { createPrismaClient } from '../../db/client.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { createMarksRepository } from '../marks/repositories/marks.repository.js';
import { createMarksService, type MarksService } from '../marks/services/marks.service.js';
import {
  createProfileRepository,
  type ProfileRepository,
} from '../profile/repositories/profile.repository.js';
import { createProfileService } from '../profile/services/profile.service.js';
import { createPublicProfileService, type PublicProfileService } from './public-profile.service.js';

// Runs against the real migrations, connected as acrux_api like the API in production.
const apiDir = fileURLToPath(new URL('../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let profiles: ProfileRepository;
let marks: MarksService;
let publicProfiles: PublicProfileService;

const OPEN = '7b1c2a3e-8b7d-4c1e-9a2f-0000000000a1';
const SHUT = '7b1c2a3e-8b7d-4c1e-9a2f-0000000000b2';

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
  profiles = createProfileRepository(prisma);
  marks = createMarksService(createMarksRepository(prisma), createProfileService(profiles));
  publicProfiles = createPublicProfileService(profiles, createMarksRepository(prisma));

  await profiles.update(
    OPEN,
    { displayName: 'Camila', avatarUrl: 'https://lh3.googleusercontent.com/a/camila' },
    { listVisibility: 'public', shown: { total: 48, mode: 'franchise' } },
  );
  await marks.put({ userId: OPEN }, 10, { status: 'seen' });
  await marks.put({ userId: OPEN }, 20, { status: 'watching' });
  await marks.put({ userId: OPEN }, 30, { status: 'seen' });
  await profiles.update(
    SHUT,
    { displayName: 'Nami', avatarUrl: null },
    { shown: { total: 7, mode: 'entry' } },
  );
  await marks.put({ userId: SHUT }, 40, { status: 'seen' });
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

// No session verifier: every request is a visitor without an account.
function app() {
  const base = createContainer({});
  return createApp({
    ...base,
    logger: pino({ enabled: false }),
    sessionVerifier: undefined,
    modules: createModules(undefined, undefined, publicProfiles),
  });
}

const withoutRequestId = ({ requestId: _id, ...body }: Record<string, unknown>) => body;

describe('GET /api/v1/profiles/{handle}', () => {
  it('@CA-RF40-01 shows a public profile to a visitor without an account', async () => {
    const response = await request(app()).get('/api/v1/profiles/camila');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      handle: 'camila',
      displayName: 'Camila',
      avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
      listVisibility: 'public',
      shownTotal: 48,
      shownMode: 'franchise',
    });
  });

  it('@CA-RF42-01 shows only the summary of a private profile, never its owner id', async () => {
    const response = await request(app()).get('/api/v1/profiles/nami');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      handle: 'nami',
      displayName: 'Nami',
      avatarUrl: null,
      listVisibility: 'private',
      shownTotal: 7,
      shownMode: 'entry',
    });
    expect(JSON.stringify(response.body)).not.toContain(SHUT);
  });

  it.each([
    ['an unknown handle', 'nadie_aqui'],
    ['an invalid handle', 'Camila;drop'],
    ['a handle with capitals', 'Camila'],
  ])('answers 404 for %s', async (_case, handle) => {
    const response = await request(app()).get(`/api/v1/profiles/${encodeURIComponent(handle)}`);
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ status: 404, code: 'profiles.not_found' });
  });
});

describe('GET /api/v1/profiles/{handle}/marks', () => {
  it('@CA-RF40-01 lists the marks of a public profile, one page at a time', async () => {
    const first = await request(app()).get('/api/v1/profiles/camila/marks?limit=2');
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('no-store');
    expect(first.body.items.map((mark: { anilistId: number }) => mark.anilistId)).toEqual([10, 20]);
    expect(first.body.items[1]).toMatchObject({ anilistId: 20, status: 'watching' });
    expect(first.body.nextCursor).toBe('20');

    const second = await request(app()).get('/api/v1/profiles/camila/marks?limit=2&cursor=20');
    expect(second.body).toMatchObject({ items: [{ anilistId: 30 }], nextCursor: null });
  });

  it('@CA-RF42-01 answers a private list exactly as an unknown handle', async () => {
    const shut = await request(app()).get('/api/v1/profiles/nami/marks');
    const unknown = await request(app()).get('/api/v1/profiles/nadie_aqui/marks');
    expect(shut.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(withoutRequestId(shut.body)).toEqual(withoutRequestId(unknown.body));
    expect(shut.headers['cache-control']).toBe('no-store');
  });

  it('stops showing the list as soon as it is made private (RF-42)', async () => {
    const user = '7b1c2a3e-8b7d-4c1e-9a2f-0000000000c3';
    const initial = { displayName: 'Robin', avatarUrl: null };
    await profiles.update(user, initial, { listVisibility: 'public' });
    await marks.put({ userId: user }, 50, { status: 'seen' });
    expect((await request(app()).get('/api/v1/profiles/robin/marks')).status).toBe(200);

    await profiles.update(user, initial, { listVisibility: 'private' });
    expect((await request(app()).get('/api/v1/profiles/robin/marks')).status).toBe(404);
  });

  it('rejects an invalid cursor or limit with 400', async () => {
    const response = await request(app()).get('/api/v1/profiles/camila/marks?limit=0');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'marks.invalid_query' });
  });
});

describe('public profile routes', () => {
  it('are public and limited per IP, and there is no route that lists profiles (RF-43)', () => {
    const routes = createModules(undefined, undefined, publicProfiles).find(
      (module) => module.name === 'public-profile',
    )?.routes;
    expect(
      routes?.map((route) => [route.method, route.path, route.public, route.rateLimit]),
    ).toEqual([
      ['get', '/api/v1/profiles/:handle', true, 'public'],
      ['get', '/api/v1/profiles/:handle/marks', true, 'public'],
      ['get', '/api/v1/profiles/:handle/og.png', true, 'public'],
      ['get', '/@:handle', true, 'public'],
    ]);
  });

  it('answer 503 when the database is not configured', async () => {
    const base = createContainer({});
    const response = await request(
      createApp({
        ...base,
        logger: pino({ enabled: false }),
        modules: createModules(undefined, undefined),
      }),
    ).get('/api/v1/profiles/camila');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'profiles.unavailable' });
  });
});

describe('GET /api/v1/profiles/{handle}/og.png', () => {
  it('draws the preview image of a profile, cached for a short while', async () => {
    const response = await request(app())
      .get('/api/v1/profiles/camila/og.png')
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
    const png = response.body as Buffer;
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    // 1200 × 630, the size social networks expect.
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }, 30_000);

  it('answers 404 for an unknown handle, without caching it', async () => {
    const response = await request(app()).get('/api/v1/profiles/nadie_aqui/og.png');
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('GET /@{handle} for link previews', () => {
  it('gives crawlers the Open Graph tags of the profile', async () => {
    const response = await request(app()).get('/@camila').set('Host', 'app.acruxanime.com');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain(
      '<meta property="og:title" content="Camila (@camila) en Acrux">',
    );
    expect(response.text).toContain(
      '<meta property="og:image" content="https://app.acruxanime.com/api/v1/profiles/camila/og.png">',
    );
    expect(response.text).toContain(
      '<meta property="og:url" content="https://app.acruxanime.com/@camila">',
    );
    expect(response.text).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(response.text).toContain('48 animes completos');
  });

  it('ignores a Host header that is not a host name', async () => {
    const response = await request(app()).get('/@camila').set('Host', 'evil.com"><script>');
    expect(response.status).toBe(200);
    expect(response.text).not.toContain('evil.com');
    expect(response.text).toContain('content="https://app.acruxanime.com/@camila"');
  });

  it('escapes the display name', async () => {
    const user = '7b1c2a3e-8b7d-4c1e-9a2f-0000000000d4';
    await profiles.update(user, { displayName: 'Zoro <script>"x"', avatarUrl: null }, {});
    const response = await request(app()).get('/@zoroscriptx');
    expect(response.status).toBe(200);
    expect(response.text).not.toContain('<script>"x"');
    expect(response.text).toContain('Zoro &lt;script&gt;&quot;x&quot;');
  });

  it('shows nothing of a private list, only the summary', async () => {
    const response = await request(app()).get('/@nami');
    expect(response.status).toBe(200);
    expect(response.text).toContain('7 entradas vistas');
    expect(response.text).not.toContain(SHUT);
  });

  it('answers a generic 404 page for an unknown handle', async () => {
    const response = await request(app()).get('/@nadie_aqui');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.text).toContain('Perfil no disponible');
  });
});
