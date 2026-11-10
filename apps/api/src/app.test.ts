import { Writable } from 'node:stream';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { type Container, createContainer, createModules } from './container.js';
import { noErrorReporter } from './http/error-reporter.js';
import { ProblemError } from './http/problem.js';
import type { Module } from './http/routes.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...String(chunk).trim().split('\n'));
      done();
    },
  });
  return { lines, logger: pino({ level: 'info' }, stream) };
}

function appWith(extra: Module[] = [], logger = captureLogs().logger) {
  const base = createContainer({});
  const container: Container = { ...base, logger, modules: [...base.modules, ...extra] };
  return createApp(container);
}

const testModule: Module = {
  name: 'test',
  routes: [
    {
      method: 'post',
      path: '/api/v1/test/echo',
      public: true,
      handler: (_request, response) => {
        response.json({ ok: true });
      },
    },
    {
      method: 'get',
      path: '/api/v1/test/conflict',
      public: true,
      handler: () => {
        throw new ProblemError(409, 'test.conflict', 'Conflict');
      },
    },
    {
      method: 'get',
      path: '/api/v1/test/crash',
      public: true,
      handler: async () => {
        throw new Error('database password is hunter2');
      },
    },
  ],
};

describe('createApp', () => {
  it('registers the seven API modules of ADR-0019 plus the system module', () => {
    const names = createContainer({}).modules.map((module) => module.name);
    expect(names).toEqual([
      'system',
      'account',
      'profile',
      'marks',
      'franchises',
      'public-profile',
      'billing',
      'anilist-link',
    ]);
  });

  it('refuses a public route that needs a role, which would skip the check (#42)', () => {
    const route = {
      method: 'put' as const,
      path: '/api/v1/test/role',
      public: true,
      role: 'curator' as const,
      handler: () => {},
    };
    expect(() => appWith([{ name: 'test', routes: [route] }])).toThrow(
      'PUT /api/v1/test/role cannot be public and need a role',
    );
  });

  it('keeps GET /api/health public and answering ok', async () => {
    const response = await request(createApp(createContainer({}))).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('does not reveal Express', async () => {
    const response = await request(appWith()).get('/api/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request id', () => {
  it('returns a fresh uuid in X-Request-Id on every response', async () => {
    const app = appWith();
    const first = await request(app).get('/api/health');
    const second = await request(app).get('/api/health');

    expect(first.headers['x-request-id']).toMatch(UUID);
    expect(second.headers['x-request-id']).toMatch(UUID);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('ignores a request id sent by the client', async () => {
    const response = await request(appWith()).get('/api/health').set('X-Request-Id', 'forged');
    expect(response.headers['x-request-id']).toMatch(UUID);
  });
});

describe('errors as application/problem+json', () => {
  it('answers 404 with a stable code and the request id', async () => {
    const response = await request(appWith()).get('/api/v1/nothing-here');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'not_found',
      requestId: response.headers['x-request-id'],
    });
  });

  it('turns a ProblemError into its status and code', async () => {
    const response = await request(appWith([testModule])).get('/api/v1/test/conflict');

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ status: 409, code: 'test.conflict', title: 'Conflict' });
  });

  it('answers 500 without leaking the error message', async () => {
    const response = await request(appWith([testModule])).get('/api/v1/test/crash');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ status: 500, code: 'internal_error' });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });

  it('answers 400 for a malformed JSON body', async () => {
    const response = await request(appWith([testModule]))
      .post('/api/v1/test/echo')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ status: 400, code: 'invalid_json' });
  });
});

describe('logs', () => {
  it('writes one JSON line per request with the ADR-0030 fields', async () => {
    const { lines, logger } = captureLogs();
    const response = await request(appWith([testModule], logger)).get('/api/health');

    const entry = JSON.parse(lines.at(-1) ?? '{}');
    expect(entry).toMatchObject({
      requestId: response.headers['x-request-id'],
      method: 'GET',
      route: '/api/health',
      status: 200,
    });
    expect(typeof entry.durationMs).toBe('number');
  });

  it('never writes the Authorization header, emails or request bodies', async () => {
    const { lines, logger } = captureLogs();
    await request(appWith([testModule], logger))
      .post('/api/v1/test/echo')
      .set('Authorization', 'Bearer secret-session-token')
      .send({ email: 'camila@correo.com', token: 'anilist-token' });
    await request(appWith([testModule], logger))
      .get('/api/v1/test/crash')
      .set('Authorization', 'Bearer secret-session-token');

    const output = lines.join('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(output).not.toMatch(/authorization/i);
    expect(output).not.toContain('secret-session-token');
    expect(output).not.toContain('camila@correo.com');
    expect(output).not.toContain('anilist-token');
  });
});

describe('telemetry environment', () => {
  it('treats empty Sentry and Vercel values as not set', () => {
    const container = createContainer({
      SENTRY_DSN: '',
      VERCEL_GIT_COMMIT_SHA: '',
      VERCEL_ENV: '',
    });
    expect(container.errorReporter).toBe(noErrorReporter);
  });
});

describe('error reporting', () => {
  function appReporting(errorReporter: Container['errorReporter'], logger = captureLogs().logger) {
    const base = createContainer({});
    return createApp({
      ...base,
      logger,
      errorReporter,
      modules: [...base.modules, testModule],
    });
  }

  it('reports an unhandled error with the request id of the response', async () => {
    const reports: { error: unknown; requestId: string }[] = [];
    const app = appReporting({
      report: async (error, context) => {
        reports.push({ error, requestId: context.requestId });
      },
    });
    const response = await request(app).get('/api/v1/test/crash');
    expect(response.status).toBe(500);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.requestId).toBe(response.headers['x-request-id']);
    expect(reports[0]?.error).toHaveProperty('message', 'database password is hunter2');
  });

  it('does not report expected errors', async () => {
    const reports: unknown[] = [];
    const app = appReporting({
      report: async (error) => {
        reports.push(error);
      },
    });
    await request(app).get('/api/v1/test/conflict');
    await request(app).get('/api/v1/nothing-here');
    await request(app).post('/api/v1/test/echo').type('json').send('{"broken"');
    const tooLarge = await request(app)
      .post('/api/v1/test/echo')
      .send({ text: 'x'.repeat(200_000) });
    expect(tooLarge.status).toBe(500);
    expect(reports).toEqual([]);
  });

  it('still answers 500 and logs a warning when reporting fails', async () => {
    const { lines, logger } = captureLogs();
    const app = appReporting(
      {
        report: async () => {
          throw new Error('sentry is down');
        },
      },
      logger,
    );
    const response = await request(app).get('/api/v1/test/crash');
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ code: 'internal_error' });
    expect(lines.join('\n')).toContain('error report failed');
  });
});

describe('rate limits', () => {
  type Call = { policy: string; key: string };

  function limiterAllowing(allowedCalls: number, retryAfterSeconds = 42) {
    const calls: Call[] = [];
    const limiter: Container['rateLimiter'] = {
      limit: async (policy, key) => {
        calls.push({ policy, key });
        return { allowed: calls.length <= allowedCalls, retryAfterSeconds };
      },
    };
    return { calls, limiter };
  }

  const limitedModule: Module = {
    name: 'limited',
    routes: [
      {
        method: 'get',
        path: '/api/v1/test/public-limited',
        public: true,
        rateLimit: 'public',
        handler: (_request, response) => {
          response.json({ ok: true });
        },
      },
      {
        method: 'post',
        path: '/api/v1/test/write',
        rateLimit: 'write',
        handler: (_request, response) => {
          response.json({ ok: true });
        },
      },
    ],
  };

  function appLimited(rateLimiter: Container['rateLimiter'], logger = captureLogs().logger) {
    const base = createContainer({});
    return createApp({
      ...base,
      logger,
      rateLimiter,
      sessionVerifier: async (token) => ({ userId: token }),
      modules: [...base.modules, testModule, limitedModule],
    });
  }

  it('answers 429 with Retry-After and a problem once the limit is exceeded', async () => {
    const app = appLimited(limiterAllowing(1).limiter);
    expect((await request(app).get('/api/v1/test/public-limited')).status).toBe(200);
    const limited = await request(app).get('/api/v1/test/public-limited');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('42');
    expect(limited.headers['content-type']).toContain('application/problem+json');
    expect(limited.body).toMatchObject({
      status: 429,
      code: 'rate_limited',
      requestId: limited.headers['x-request-id'],
    });
  });

  it('counts public routes per client IP, without storing the IP', async () => {
    const { calls, limiter } = limiterAllowing(10);
    const app = appLimited(limiter);
    await request(app)
      .get('/api/v1/test/public-limited')
      .set('x-vercel-forwarded-for', '203.0.113.7');
    await request(app)
      .get('/api/v1/test/public-limited')
      .set('x-vercel-forwarded-for', '203.0.113.7');
    await request(app)
      .get('/api/v1/test/public-limited')
      .set('x-vercel-forwarded-for', '198.51.100.9');
    expect(calls.map((call) => call.policy)).toEqual(['public', 'public', 'public']);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key).not.toBe(calls[2]?.key);
    expect(JSON.stringify(calls)).not.toContain('203.0.113.7');
  });

  it('counts private routes per user, after the session check', async () => {
    const { calls, limiter } = limiterAllowing(10);
    const app = appLimited(limiter);
    const missing = await request(app).post('/api/v1/test/write');
    expect(missing.status).toBe(401);
    expect(calls).toEqual([]);
    await request(app).post('/api/v1/test/write').set('Authorization', 'Bearer user-a');
    await request(app).post('/api/v1/test/write').set('Authorization', 'Bearer user-a');
    await request(app).post('/api/v1/test/write').set('Authorization', 'Bearer user-b');
    expect(calls.map((call) => call.policy)).toEqual(['write', 'write', 'write']);
    expect(calls[0]?.key).toBe(calls[1]?.key);
    expect(calls[0]?.key).not.toBe(calls[2]?.key);
    expect(JSON.stringify(calls)).not.toContain('user-a');
  });

  it('lets the request through and logs a warning when the store fails', async () => {
    const { lines, logger } = captureLogs();
    const app = appLimited(
      {
        limit: async () => {
          throw new Error('upstash is down');
        },
      },
      logger,
    );
    const response = await request(app).get('/api/v1/test/public-limited');
    expect(response.status).toBe(200);
    expect(lines.join('\n')).toContain('rate limit check failed');
  });

  it('leaves routes without a limit alone', async () => {
    const { calls, limiter } = limiterAllowing(0);
    const app = appLimited(limiter);
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).post('/api/v1/test/echo').send({})).status).toBe(200);
    expect(calls).toEqual([]);
  });
});

describe('GET /api/v1/me', () => {
  const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';

  function appWithProfiles(profileService: Container['profileService']) {
    const base = createContainer({});
    return createApp({
      ...base,
      profileService,
      sessionVerifier: async () => ({
        userId: USER,
        name: 'Camila',
        image: 'https://lh3.googleusercontent.com/a/camila',
      }),
      modules: createModules(profileService, undefined),
    });
  }

  it('creates the profile from the Google name and avatar and returns it without the email', async () => {
    const calls: unknown[] = [];
    const app = appWithProfiles({
      me: async (session) => {
        calls.push(session);
        return {
          displayName: session.name ?? '',
          avatarUrl: session.image ?? null,
          locale: 'es',
          listVisibility: 'private',
          counterMode: 'franchise',
          handle: 'camila',
          avatarPreset: null,
          shownTotal: null,
          shownMode: null,
          cardShared: false,
          createdAt: new Date('2026-11-01T12:00:00.000Z'),
          analyticsId: '0123456789abcdef0123456789abcdef',
        };
      },
      ensureProfile: async () => {},
      findByHandle: async () => null,
      remove: async () => false,
      update: async () => {
        throw new Error('not used');
      },
    });
    const response = await request(app).get('/api/v1/me').set('Authorization', 'Bearer token');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      displayName: 'Camila',
      avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
      locale: 'es',
      listVisibility: 'private',
      counterMode: 'franchise',
      handle: 'camila',
      avatarPreset: null,
      shownTotal: null,
      shownMode: null,
      cardShared: false,
      createdAt: '2026-11-01T12:00:00.000Z',
      analyticsId: '0123456789abcdef0123456789abcdef',
      curator: false,
      plan: 'free',
      plusAvailable: false,
    });
    expect(calls).toHaveLength(1);
  });

  it('requires a session', async () => {
    const app = appWithProfiles(undefined);
    const response = await request(app).get('/api/v1/me');
    expect(response.status).toBe(401);
  });

  it('answers 503 when the database is not configured', async () => {
    const app = appWithProfiles(undefined);
    const response = await request(app).get('/api/v1/me').set('Authorization', 'Bearer token');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'profile.unavailable' });
  });
});

describe('PATCH /api/v1/me', () => {
  const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
  const auth = { Authorization: 'Bearer token' };

  function fakeProfiles() {
    const calls: unknown[] = [];
    const service: NonNullable<Container['profileService']> = {
      me: async () => {
        throw new Error('not used');
      },
      ensureProfile: async () => {},
      findByHandle: async () => null,
      remove: async () => false,
      update: async (session, changes) => {
        calls.push({ session, changes });
        return {
          displayName: changes.displayName ?? 'Camila',
          avatarUrl: null,
          avatarPreset: changes.avatarPreset ?? null,
          locale: changes.locale === undefined ? null : changes.locale,
          listVisibility: changes.listVisibility ?? 'private',
          counterMode: changes.counterMode ?? 'franchise',
          handle: 'camila',
          shownTotal: changes.shown?.total ?? null,
          shownMode: changes.shown?.mode ?? null,
          cardShared: changes.cardShared ?? false,
          createdAt: new Date('2026-11-01T12:00:00.000Z'),
          analyticsId: null,
        };
      },
    };
    return { calls, service };
  }

  function appWithProfiles(profileService: Container['profileService']) {
    const base = createContainer({});
    return createApp({
      ...base,
      profileService,
      sessionVerifier: async () => ({ userId: USER, name: 'Camila' }),
      modules: createModules(profileService, undefined),
    });
  }

  it('saves the counter mode of the session user and returns the profile', async () => {
    const { calls, service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send({ counterMode: 'entry' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toEqual({
      displayName: 'Camila',
      avatarUrl: null,
      locale: null,
      listVisibility: 'private',
      counterMode: 'entry',
      handle: 'camila',
      avatarPreset: null,
      shownTotal: null,
      shownMode: null,
      cardShared: false,
      createdAt: '2026-11-01T12:00:00.000Z',
      analyticsId: null,
      curator: false,
      plan: 'free',
      plusAvailable: false,
    });
    expect(calls).toEqual([
      { session: { userId: USER, name: 'Camila' }, changes: { counterMode: 'entry' } },
    ]);
  });

  it('@CA-RF07-01 saves the display name, trimmed, and a preset avatar (RF-07)', async () => {
    const { calls, service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send({ displayName: '  Cami  ', avatarPreset: 'coral' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ displayName: 'Cami', avatarPreset: 'coral' });
    expect(calls).toEqual([
      {
        session: { userId: USER, name: 'Camila' },
        changes: { displayName: 'Cami', avatarPreset: 'coral' },
      },
    ]);
  });

  it('goes back to the Google avatar with a null preset', async () => {
    const { calls, service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send({ avatarPreset: null });
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { session: { userId: USER, name: 'Camila' }, changes: { avatarPreset: null } },
    ]);
  });

  describe('Plus avatars (RF-55)', () => {
    function appOnPlan(profileService: Container['profileService'], plan: 'free' | 'plus') {
      const base = createContainer({});
      const planOf = async () => plan;
      return createApp({
        ...base,
        profileService,
        sessionVerifier: async () => ({ userId: USER, name: 'Camila' }),
        modules: createModules(
          profileService,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          planOf,
        ),
      });
    }

    it('@CA-RF55-03 refuses a Plus avatar to a free user with 403 and changes nothing', async () => {
      const { calls, service } = fakeProfiles();
      const response = await request(appOnPlan(service, 'free'))
        .patch('/api/v1/me')
        .set(auth)
        .send({ avatarPreset: 'sakura' });
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'plan.plus_required' });
      expect(calls).toEqual([]);
    });

    it('saves a Plus avatar for a Plus user', async () => {
      const { calls, service } = fakeProfiles();
      const response = await request(appOnPlan(service, 'plus'))
        .patch('/api/v1/me')
        .set(auth)
        .send({ avatarPreset: 'aurora' });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ avatarPreset: 'aurora', plan: 'plus' });
      expect(calls).toEqual([
        { session: { userId: USER, name: 'Camila' }, changes: { avatarPreset: 'aurora' } },
      ]);
    });

    it('still lets a free user pick a free avatar', async () => {
      const { service } = fakeProfiles();
      const response = await request(appOnPlan(service, 'free'))
        .patch('/api/v1/me')
        .set(auth)
        .send({ avatarPreset: 'coral' });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ avatarPreset: 'coral' });
    });

    it.each([
      ['free', null],
      ['plus', 'eclipse'],
    ] as const)(
      'shows a stored Plus avatar to a %s user as %s, keeping it for a later purchase (RF-56)',
      async (plan, shown) => {
        const { service } = fakeProfiles();
        const stored = {
          ...service,
          me: async () => ({
            ...(await service.update({ userId: USER }, {})),
            avatarPreset: 'eclipse' as const,
          }),
        };
        const response = await request(appOnPlan(stored, plan)).get('/api/v1/me').set(auth);
        expect(response.status).toBe(200);
        expect(response.body.avatarPreset).toBe(shown);
      },
    );
  });

  it('accepts an emoji joined with ZWJ', async () => {
    const { service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send({ displayName: 'Ana 👩\u200D💻' });
    expect(response.status).toBe(200);
  });

  it('accepts a 30-character name, emoji counted once', async () => {
    const { service } = fakeProfiles();
    const name = `${'a'.repeat(29)}🌸`;
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send({ displayName: name });
    expect(response.status).toBe(200);
  });

  it.each([
    ['English', 'en'],
    ['Spanish', 'es'],
    ['the browser language again (null)', null],
  ])('saves %s as the language of the account (#43)', async (_case, locale) => {
    const { calls, service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send({ locale });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ locale });
    expect(calls).toEqual([{ session: { userId: USER, name: 'Camila' }, changes: { locale } }]);
  });

  it('saves the visibility of the list, the shown counter and the first card shared', async () => {
    const { calls, service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send({
        listVisibility: 'public',
        shown: { total: 48, mode: 'franchise' },
        cardShared: true,
      });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      listVisibility: 'public',
      shownTotal: 48,
      shownMode: 'franchise',
      cardShared: true,
    });
    expect(calls).toEqual([
      {
        session: { userId: USER, name: 'Camila' },
        changes: {
          listVisibility: 'public',
          shown: { total: 48, mode: 'franchise' },
          cardShared: true,
        },
      },
    ]);
  });

  it.each([
    ['an unknown mode', { counterMode: 'episode' }],
    ['an empty body', {}],
    ['a field it does not change yet', { counterMode: 'entry', titleLanguage: 'romaji' }],
    ['an unsupported language', { locale: 'fr' }],
    ['a language with its region', { locale: 'es-CL' }],
    ['an unknown visibility', { listVisibility: 'friends' }],
    ['a negative shown total', { shown: { total: -1, mode: 'entry' } }],
    ['a fractional shown total', { shown: { total: 1.5, mode: 'entry' } }],
    ['a shown counter without its mode', { shown: { total: 3 } }],
    ['cardShared false', { cardShared: false }],
    ['a handle', { handle: 'otra' }],
    ['an empty name', { displayName: '' }],
    ['a name of spaces', { displayName: '   ' }],
    ['a name over 30 characters', { displayName: 'a'.repeat(31) }],
    ['a name with a line break', { displayName: 'Cami\nla' }],
    ['a name with a control character', { displayName: 'Cami\u0007' }],
    ['a name with a line separator', { displayName: 'Cami\u2028la' }],
    ['a name with a bidi override', { displayName: 'Ca\u202Emila' }],
    ['a name of invisible characters', { displayName: '\u200B\u200B\u200B' }],
    ['a name that is not text', { displayName: 42 }],
    ['an unknown preset', { avatarPreset: 'rosa' }],
    ['an avatar URL', { avatarUrl: 'https://example.com/a.png' }],
  ])('rejects %s with 400 and changes nothing', async (_case, body) => {
    const { calls, service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .set(auth)
      .send(body);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'profile.invalid_body' });
    expect(calls).toEqual([]);
  });

  it('requires a session', async () => {
    const { service } = fakeProfiles();
    const response = await request(appWithProfiles(service))
      .patch('/api/v1/me')
      .send({ counterMode: 'entry' });
    expect(response.status).toBe(401);
  });

  it('answers 503 when the database is not configured', async () => {
    const response = await request(appWithProfiles(undefined))
      .patch('/api/v1/me')
      .set(auth)
      .send({ counterMode: 'entry' });
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'profile.unavailable' });
  });
});

describe('/api/v1/me/marks', () => {
  const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
  const MARKED_AT = new Date('2026-11-03T12:00:00.000Z');
  type Call = { method: string; args: unknown[] };

  function fakeMarks() {
    const calls: Call[] = [];
    const service: NonNullable<Container['marksService']> = {
      listOf: async () => {
        throw new Error('not used');
      },
      list: async (...args) => {
        calls.push({ method: 'list', args });
        return {
          items: [
            { anilistId: 16498, malId: 16498, status: 'seen', markedAt: MARKED_AT },
            { anilistId: 20958, malId: null, status: 'watching', markedAt: MARKED_AT },
          ],
          nextCursor: args[1].after === undefined ? null : 20958,
        };
      },
      put: async (...args) => {
        calls.push({ method: 'put', args });
        const [, anilistId, input] = args;
        return { anilistId, malId: input.malId ?? null, status: input.status, markedAt: MARKED_AT };
      },
      remove: async (...args) => {
        calls.push({ method: 'remove', args });
      },
      batch: async (...args) => {
        calls.push({ method: 'batch', args });
        const [, input] = args;
        const status = input.status;
        if (status === null) return [];
        return input.entries.map((entry) => ({
          anilistId: entry.anilistId,
          malId: entry.malId ?? null,
          status,
          markedAt: MARKED_AT,
        }));
      },
    };
    return { calls, service };
  }

  function appWithMarks(
    marksService: Container['marksService'],
    rateLimiter: Container['rateLimiter'] = createContainer({}).rateLimiter,
  ) {
    const base = createContainer({});
    return createApp({
      ...base,
      logger: captureLogs().logger,
      rateLimiter,
      marksService,
      sessionVerifier: async () => ({ userId: USER, name: 'Camila' }),
      modules: createModules(undefined, marksService),
    });
  }

  const auth = { Authorization: 'Bearer token' };

  describe('GET', () => {
    it('lists the marks of the session user with ISO dates and a null cursor', async () => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service)).get('/api/v1/me/marks').set(auth);
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.body).toEqual({
        items: [
          { anilistId: 16498, malId: 16498, status: 'seen', markedAt: '2026-11-03T12:00:00.000Z' },
          {
            anilistId: 20958,
            malId: null,
            status: 'watching',
            markedAt: '2026-11-03T12:00:00.000Z',
          },
        ],
        nextCursor: null,
      });
      expect(calls).toEqual([
        { method: 'list', args: [{ userId: USER, name: 'Camila' }, { limit: 500 }] },
      ]);
    });

    it('pages from the cursor with the limit and returns the next cursor as a string', async () => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .get('/api/v1/me/marks?cursor=16000&limit=2')
        .set(auth);
      expect(response.status).toBe(200);
      expect(response.body.nextCursor).toBe('20958');
      expect(calls).toEqual([
        {
          method: 'list',
          args: [
            { userId: USER, name: 'Camila' },
            { after: 16000, limit: 2 },
          ],
        },
      ]);
    });

    it.each([
      ['a cursor that is not a positive integer', 'cursor=abc'],
      ['a zero cursor', 'cursor=0'],
      ['a cursor past int4', 'cursor=2147483648'],
      ['a zero limit', 'limit=0'],
      ['a limit over 1000', 'limit=1001'],
      ['a limit that is not an integer', 'limit=1e3'],
      ['a repeated cursor', 'cursor=1&cursor=2'],
    ])('answers 400 for %s', async (_case, query) => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .get(`/api/v1/me/marks?${query}`)
        .set(auth);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'marks.invalid_query' });
      expect(calls).toEqual([]);
    });
  });

  describe('PUT', () => {
    it('stores the mark and returns it', async () => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .put('/api/v1/me/marks/16498')
        .set(auth)
        .send({ status: 'seen', malId: 16498 });
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.body).toEqual({
        anilistId: 16498,
        malId: 16498,
        status: 'seen',
        markedAt: '2026-11-03T12:00:00.000Z',
      });
      expect(calls).toEqual([
        {
          method: 'put',
          args: [{ userId: USER, name: 'Camila' }, 16498, { status: 'seen', malId: 16498 }],
        },
      ]);
    });

    it('accepts a body without malId and with a null malId', async () => {
      const { calls, service } = fakeMarks();
      const app = appWithMarks(service);
      const withoutMalId = await request(app)
        .put('/api/v1/me/marks/1')
        .set(auth)
        .send({ status: 'watching' });
      const nullMalId = await request(app)
        .put('/api/v1/me/marks/1')
        .set(auth)
        .send({ status: 'watching', malId: null });
      expect(withoutMalId.status).toBe(200);
      expect(nullMalId.status).toBe(200);
      expect(calls.map((call) => call.args[2])).toEqual([
        { status: 'watching' },
        { status: 'watching', malId: null },
      ]);
    });

    it.each(['0', '-1', 'abc', '1.5', '1e3', '2147483648'])(
      'answers 400 for the anilistId %s',
      async (id) => {
        const { calls, service } = fakeMarks();
        const response = await request(appWithMarks(service))
          .put(`/api/v1/me/marks/${id}`)
          .set(auth)
          .send({ status: 'seen' });
        expect(response.status).toBe(400);
        expect(response.headers['content-type']).toContain('application/problem+json');
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.body).toMatchObject({ code: 'marks.invalid_anilist_id' });
        expect(calls).toEqual([]);
      },
    );

    it.each([
      ['an unknown status', { status: 'dropped' }],
      ['a missing status', {}],
      ['a null status', { status: null }],
      ['an unknown field', { status: 'seen', score: 10 }],
      ['a malId that is not a positive integer', { status: 'seen', malId: 'x' }],
      ['a zero malId', { status: 'seen', malId: 0 }],
    ])('answers 400 for %s', async (_case, body) => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .put('/api/v1/me/marks/16498')
        .set(auth)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({ code: 'marks.invalid_body' });
      expect(calls).toEqual([]);
    });

    it('answers 400 without a body', async () => {
      const { service } = fakeMarks();
      const response = await request(appWithMarks(service)).put('/api/v1/me/marks/16498').set(auth);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'marks.invalid_body' });
    });
  });

  describe('DELETE', () => {
    it('removes the mark and answers 204', async () => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .delete('/api/v1/me/marks/16498')
        .set(auth);
      expect(response.status).toBe(204);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.text).toBe('');
      expect(calls).toEqual([
        { method: 'remove', args: [{ userId: USER, name: 'Camila' }, 16498] },
      ]);
    });

    it('answers 400 for an invalid anilistId', async () => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .delete('/api/v1/me/marks/abc')
        .set(auth);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'marks.invalid_anilist_id' });
      expect(calls).toEqual([]);
    });
  });

  describe('POST :batch', () => {
    const entries = (count: number) =>
      Array.from({ length: count }, (_, index) => ({ anilistId: index + 1 }));

    it('writes every entry and returns the marks', async () => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .post('/api/v1/me/marks:batch')
        .set(auth)
        .send({
          status: 'seen',
          entries: [{ anilistId: 16498, malId: 16498 }, { anilistId: 20958 }],
        });
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.body).toEqual({
        items: [
          { anilistId: 16498, malId: 16498, status: 'seen', markedAt: '2026-11-03T12:00:00.000Z' },
          { anilistId: 20958, malId: null, status: 'seen', markedAt: '2026-11-03T12:00:00.000Z' },
        ],
      });
      expect(calls).toEqual([
        {
          method: 'batch',
          args: [
            { userId: USER, name: 'Camila' },
            { status: 'seen', entries: [{ anilistId: 16498, malId: 16498 }, { anilistId: 20958 }] },
          ],
        },
      ]);
    });

    it('removes the marks with a null status and returns no items', async () => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .post('/api/v1/me/marks:batch')
        .set(auth)
        .send({ status: null, entries: [{ anilistId: 16498 }] });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [] });
      expect(calls[0]?.args[1]).toEqual({ status: null, entries: [{ anilistId: 16498 }] });
    });

    it('accepts 200 entries', async () => {
      const { service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .post('/api/v1/me/marks:batch')
        .set(auth)
        .send({ status: 'seen', entries: entries(200) });
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(200);
    });

    it.each([
      ['no entries', { status: 'seen', entries: [] }],
      ['201 entries', { status: 'seen', entries: entries(201) }],
      ['a repeated entry', { status: 'seen', entries: [{ anilistId: 7 }, { anilistId: 7 }] }],
      ['a missing status', { entries: [{ anilistId: 7 }] }],
      ['an unknown status', { status: 'dropped', entries: [{ anilistId: 7 }] }],
      ['an unknown field', { status: 'seen', entries: [{ anilistId: 7 }], all: true }],
      ['an unknown entry field', { status: 'seen', entries: [{ anilistId: 7, title: 'x' }] }],
      ['a zero anilistId', { status: 'seen', entries: [{ anilistId: 0 }] }],
      ['a string anilistId', { status: 'seen', entries: [{ anilistId: '7' }] }],
      ['an anilistId over int4', { status: 'seen', entries: [{ anilistId: 2147483648 }] }],
      ['a fractional malId', { status: 'seen', entries: [{ anilistId: 7, malId: 1.5 }] }],
    ])('answers 400 for %s', async (_case, body) => {
      const { calls, service } = fakeMarks();
      const response = await request(appWithMarks(service))
        .post('/api/v1/me/marks:batch')
        .set(auth)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({ code: 'marks.invalid_body' });
      expect(calls).toEqual([]);
    });
  });

  it('requires a session on the four routes', async () => {
    const app = appWithMarks(fakeMarks().service);
    const responses = await Promise.all([
      request(app).get('/api/v1/me/marks'),
      request(app).put('/api/v1/me/marks/1').send({ status: 'seen' }),
      request(app).delete('/api/v1/me/marks/1'),
      request(app)
        .post('/api/v1/me/marks:batch')
        .send({ status: 'seen', entries: [{ anilistId: 1 }] }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
  });

  it('answers 503 on the four routes when the database is not configured', async () => {
    const app = appWithMarks(undefined);
    const responses = await Promise.all([
      request(app).get('/api/v1/me/marks').set(auth),
      request(app).put('/api/v1/me/marks/1').set(auth).send({ status: 'seen' }),
      request(app).delete('/api/v1/me/marks/1').set(auth),
      request(app)
        .post('/api/v1/me/marks:batch')
        .set(auth)
        .send({ status: 'seen', entries: [{ anilistId: 1 }] }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ code: 'marks.unavailable' });
    }
  });

  it('counts the writes with the write limit and leaves the read alone', async () => {
    const policies: string[] = [];
    const app = appWithMarks(fakeMarks().service, {
      limit: async (policy) => {
        policies.push(policy);
        return { allowed: true, retryAfterSeconds: 0 };
      },
    });
    await request(app).get('/api/v1/me/marks').set(auth);
    expect(policies).toEqual([]);
    await request(app).put('/api/v1/me/marks/1').set(auth).send({ status: 'seen' });
    await request(app).delete('/api/v1/me/marks/1').set(auth);
    await request(app)
      .post('/api/v1/me/marks:batch')
      .set(auth)
      .send({ status: 'seen', entries: [{ anilistId: 1 }] });
    expect(policies).toEqual(['write', 'write', 'write']);
  });
});
