import { Writable } from 'node:stream';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { type Container, createContainer } from './container.js';
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
