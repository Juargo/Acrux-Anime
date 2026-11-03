import { describe, expect, it } from 'vitest';
import { AniListError } from './client';
import { createQueryClient, shouldRetry } from './query-client';

describe('createQueryClient', () => {
  it('keeps answers in memory only, for a limited time', () => {
    const defaults = createQueryClient().getDefaultOptions().queries;
    expect(defaults?.gcTime).toBe(10 * 60_000);
    expect(defaults?.staleTime).toBe(5 * 60_000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
  });
});

describe('shouldRetry', () => {
  it('never repeats what the client already waited out or what cannot change', () => {
    for (const kind of ['rate-limited', 'query', 'invalid-response'] as const) {
      expect(shouldRetry(0, new AniListError(kind, kind))).toBe(false);
    }
  });

  it('retries a network failure once', () => {
    const offline = new AniListError('unavailable', 'offline');
    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(1, offline)).toBe(false);
  });
});
