import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import type { UserPlan } from '../../http/plan.js';
import type { ProfileChanges, ProfileView } from './repositories/profile.repository.js';

// Card themes (RF-52, epic #50): Clásica is free and Neón needs Plus. The plan is read from
// the database on every request; without Plus the card falls back to Clásica (RF-56).
const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f71';
const bearer = ['Authorization', 'Bearer token'] as const;

function appFor(plan: UserPlan | undefined, stored: ProfileView['cardTheme'] = 'clasica') {
  const saved: ProfileChanges[] = [];
  let profile: ProfileView = {
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
    cardTheme: stored,
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
  };
  const profiles = {
    me: async () => ({ ...profile, analyticsId: null }),
    ensureProfile: async () => {},
    findByHandle: async () => null,
    remove: async () => false,
    update: async (_session: unknown, changes: ProfileChanges) => {
      saved.push(changes);
      profile = { ...profile, ...(changes.cardTheme && { cardTheme: changes.cardTheme }) };
      return { ...profile, analyticsId: null };
    },
  };
  const planOf = plan ? async () => plan : undefined;
  const app = createApp({
    ...createContainer({}),
    sessionVerifier: async () => ({ userId: USER }),
    planOf,
    modules: createModules(profiles, undefined, undefined, undefined, undefined, undefined, planOf),
  });
  return { app, saved };
}

const patch = (app: ReturnType<typeof appFor>['app'], body: unknown) =>
  request(app)
    .patch('/api/v1/me')
    .set(...bearer)
    .send(body as object);

describe('card theme (RF-52)', () => {
  it('@CA-RF52-01 lets a Plus user save Neón and returns it on every device', async () => {
    const { app, saved } = appFor('plus');

    const patched = await patch(app, { cardTheme: 'neon' });

    expect(patched.status).toBe(200);
    expect(patched.body.cardTheme).toBe('neon');
    expect(saved).toEqual([{ cardTheme: 'neon' }]);
    const read = await request(app)
      .get('/api/v1/me')
      .set(...bearer);
    expect(read.body.cardTheme).toBe('neon');
  });

  it('@CA-RF52-02 refuses Neón to a free user and saves nothing', async () => {
    const { app, saved } = appFor('free');

    const patched = await patch(app, { cardTheme: 'neon' });

    expect(patched.status).toBe(403);
    expect(patched.body.code).toBe('plan.plus_required');
    expect(saved).toEqual([]);
  });

  it('refuses Neón when there is no plan reader, and with other changes in the same body', async () => {
    const { app, saved } = appFor(undefined);

    const patched = await patch(app, { cardTheme: 'neon', counterMode: 'entry' });

    expect(patched.status).toBe(403);
    expect(saved).toEqual([]);
  });

  it('lets anyone go back to Clásica', async () => {
    const { app, saved } = appFor('free', 'neon');

    const patched = await patch(app, { cardTheme: 'clasica' });

    expect(patched.status).toBe(200);
    expect(patched.body.cardTheme).toBe('clasica');
    expect(saved).toEqual([{ cardTheme: 'clasica' }]);
  });

  it('@CA-RF56-03 shows Clásica after a refund without rewriting the stored theme', async () => {
    const { app, saved } = appFor('free', 'neon');

    const read = await request(app)
      .get('/api/v1/me')
      .set(...bearer);
    expect(read.body.cardTheme).toBe('clasica');
    const patched = await patch(app, { counterMode: 'entry' });
    expect(patched.body.cardTheme).toBe('clasica');
    expect(saved).toEqual([{ counterMode: 'entry' }]);
  });

  it('rejects an unknown theme, including Manga until it has a design', async () => {
    const { app, saved } = appFor('plus');

    for (const cardTheme of ['manga', 'NEON', '', null]) {
      const patched = await patch(app, { cardTheme });
      expect(patched.status).toBe(400);
    }
    expect(saved).toEqual([]);
  });
});
