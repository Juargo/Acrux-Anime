import { Writable } from 'node:stream';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { type Container, createContainer } from './container.js';
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
