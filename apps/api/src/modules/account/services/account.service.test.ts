import { describe, expect, it } from 'vitest';
import { createAccountService } from './account.service.js';

const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const session = { userId: USER };

function fakes(failing: { directory?: boolean; persons?: boolean } = {}) {
  const calls: string[] = [];
  return {
    calls,
    profiles: {
      me: async () => {
        throw new Error('not used');
      },
      remove: async (userId: string) => {
        calls.push(`remove ${userId}`);
        return true;
      },
    },
    marks: { listOf: async () => ({ items: [], nextCursor: null }) },
    directory: {
      deleteUser: async (userId: string) => {
        calls.push(`neon ${userId}`);
        if (failing.directory) throw new Error('Neon Auth answered 500');
      },
    },
    persons: {
      deletePerson: async (distinctId: string) => {
        calls.push(`posthog ${distinctId}`);
        if (failing.persons) throw new Error('PostHog answered 500');
      },
    },
    analyticsIdOf: () => 'salted',
  };
}

describe('account service', () => {
  it('deletes the data, then the Neon Auth user, then the PostHog person', async () => {
    const { calls, ...deps } = fakes();
    expect(await createAccountService(deps).deleteAccount(session)).toEqual({});
    expect(calls).toEqual([`remove ${USER}`, `neon ${USER}`, 'posthog salted']);
  });

  it('stops before PostHog when Neon Auth fails, so the retry does it all', async () => {
    const { calls, ...deps } = fakes({ directory: true });
    await expect(createAccountService(deps).deleteAccount(session)).rejects.toMatchObject({
      name: 'AuthDeletionError',
    });
    expect(calls).toEqual([`remove ${USER}`, `neon ${USER}`]);
  });

  it('finishes the deletion when PostHog fails and returns the error to report', async () => {
    const { calls, ...deps } = fakes({ persons: true });
    const result = await createAccountService(deps).deleteAccount(session);
    expect(result.analyticsError).toBeInstanceOf(Error);
    expect(calls).toHaveLength(3);
  });

  it('skips PostHog without its credentials or without the analytics secret', async () => {
    const { calls, persons: _persons, ...deps } = fakes();
    await createAccountService(deps).deleteAccount(session);
    const noSecret = fakes();
    await createAccountService({ ...noSecret, analyticsIdOf: () => null }).deleteAccount(session);
    expect(calls).toEqual([`remove ${USER}`, `neon ${USER}`]);
    expect(noSecret.calls).toEqual([`remove ${USER}`, `neon ${USER}`]);
  });

  it('deletes nothing without the Neon credentials', async () => {
    const { calls, directory: _directory, ...deps } = fakes();
    const service = createAccountService(deps);
    expect(service.canDelete).toBe(false);
    await expect(service.deleteAccount(session)).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('exports every page of marks', async () => {
    const mark = (anilistId: number) => ({
      anilistId,
      malId: null,
      status: 'seen' as const,
      markedAt: new Date('2026-11-01T00:00:00.000Z'),
    });
    const pages = new Map([
      [undefined, { items: [mark(1), mark(2)], nextCursor: 2 }],
      [2, { items: [mark(3)], nextCursor: null }],
    ]);
    const service = createAccountService({
      profiles: {
        me: async () => ({
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
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          analyticsId: 'salted',
        }),
        remove: async () => true,
      },
      marks: {
        listOf: async (_userId, { after }) => pages.get(after) ?? { items: [], nextCursor: null },
      },
      now: () => new Date('2026-11-05T00:00:00.000Z'),
    });
    const data = await service.exportData(session);
    expect(data.marks.map((m) => m.anilistId)).toEqual([1, 2, 3]);
    expect(data.profile).not.toHaveProperty('analyticsId');
    expect(data.exportedAt).toEqual(new Date('2026-11-05T00:00:00.000Z'));
  });
});
