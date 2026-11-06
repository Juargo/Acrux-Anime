import { describe, expect, it } from 'vitest';
import { analyticsId } from '../domain/analytics-id.js';
import type { ProfileRepository, ProfileView } from '../repositories/profile.repository.js';
import { createProfileService } from './profile.service.js';

const SECRET = 'a-secret-of-at-least-thirty-two-characters';
const view: ProfileView = {
  displayName: 'Camila',
  avatarUrl: null,
  avatarPreset: null,
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: null,
  shownMode: null,
  cardShared: false,
  createdAt: new Date('2026-11-01T12:00:00.000Z'),
};
const repository = {
  findOrCreate: async () => view,
  update: async () => view,
  findByHandle: async () => null,
  remove: async () => false,
} as ProfileRepository;
const session = { userId: '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70', name: 'Camila' };

describe('profile service', () => {
  it('adds the salted analytics id to the profile (#46)', async () => {
    const profiles = createProfileService(repository, { analyticsSecret: SECRET });
    const expected = analyticsId(session.userId, SECRET);
    expect(await profiles.me(session)).toMatchObject({ analyticsId: expected, handle: 'camila' });
    expect(await profiles.update(session, { counterMode: 'entry' })).toMatchObject({
      analyticsId: expected,
    });
  });

  it('gives no analytics id without the secret', async () => {
    const profiles = createProfileService(repository);
    expect((await profiles.me(session)).analyticsId).toBeNull();
  });
});
