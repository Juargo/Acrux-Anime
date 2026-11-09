import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { type Container, createContainer } from '../container.js';
import type { PlanReader } from './plan.js';
import type { Module } from './routes.js';

// requirePlan('plus') (ADR-0025, S6, S10): the plan is read from the database on every
// request and never taken from the client or the JWT.
const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const bearer = ['Authorization', 'Bearer token'] as const;

const plusModule: Module = {
  name: 'test',
  routes: [
    {
      method: 'get',
      path: '/api/v1/test/plus',
      plan: 'plus',
      handler: (_request, response) => {
        response.json({ ok: true });
      },
    },
  ],
};

function appWith(planOf: PlanReader | undefined, modules: Module[] = [plusModule]) {
  const base = createContainer({});
  const container: Container = {
    ...base,
    sessionVerifier: async () => ({ userId: USER }),
    planOf,
    modules,
  };
  return createApp(container);
}

describe('requirePlan', () => {
  it('lets a Plus user through', async () => {
    const response = await request(appWith(async () => 'plus'))
      .get('/api/v1/test/plus')
      .set(...bearer);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('answers 403 to a free user', async () => {
    const response = await request(appWith(async () => 'free'))
      .get('/api/v1/test/plus')
      .set(...bearer);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('plan.plus_required');
  });

  it("reads the session user's plan on every request, so a refund applies at once", async () => {
    const asked: string[] = [];
    let plan: 'free' | 'plus' = 'plus';
    const app = appWith(async (userId) => {
      asked.push(userId);
      return plan;
    });

    expect(
      (
        await request(app)
          .get('/api/v1/test/plus')
          .set(...bearer)
      ).status,
    ).toBe(200);
    plan = 'free';
    expect(
      (
        await request(app)
          .get('/api/v1/test/plus')
          .set(...bearer)
      ).status,
    ).toBe(403);
    expect(asked).toEqual([USER, USER]);
  });

  it('ignores a plan the client claims to have (S10)', async () => {
    const response = await request(appWith(async () => 'free'))
      .get('/api/v1/test/plus?plan=plus')
      .set(...bearer)
      .set('X-Plan', 'plus');
    expect(response.status).toBe(403);
  });

  it('answers 503 when the plan cannot be read', async () => {
    const response = await request(appWith(undefined))
      .get('/api/v1/test/plus')
      .set(...bearer);
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('plan.unavailable');
  });

  it('checks the session first', async () => {
    const response = await request(appWith(async () => 'plus')).get('/api/v1/test/plus');
    expect(response.status).toBe(401);
  });

  it('refuses a public route that needs a plan, which would skip the check', () => {
    const route = {
      method: 'get' as const,
      path: '/api/v1/test/open-plus',
      public: true,
      plan: 'plus' as const,
      handler: () => {},
    };
    expect(() => appWith(async () => 'plus', [{ name: 'test', routes: [route] }])).toThrow(
      'GET /api/v1/test/open-plus cannot be public and need a plan',
    );
  });
});
