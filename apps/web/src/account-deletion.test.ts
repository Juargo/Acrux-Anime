import { describe, expect, it } from 'vitest';
import { finishAccountDeletion } from './account-deletion';
import type { Analytics } from './analytics/analytics';

function fakeAnalytics(calls: string[]) {
  return {
    forget: () => calls.push('forget'),
    capture: (event: string, properties?: Record<string, unknown>) =>
      calls.push(`capture ${event} ${JSON.stringify(properties ?? {})}`),
  } as unknown as Analytics;
}

describe('finishAccountDeletion', () => {
  it('forgets the person before sending account_deleted, so the event creates nobody', async () => {
    const calls: string[] = [];
    await finishAccountDeletion({
      analytics: fakeAnalytics(calls),
      signOut: async () => {
        calls.push('signOut');
      },
    });
    expect(calls).toEqual(['forget', 'capture account_deleted {}', 'signOut']);
  });

  it('finishes when signing out fails, because the Neon Auth user is already gone', async () => {
    const calls: string[] = [];
    await expect(
      finishAccountDeletion({
        analytics: undefined,
        signOut: async () => {
          throw new Error('User not found');
        },
      }),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
