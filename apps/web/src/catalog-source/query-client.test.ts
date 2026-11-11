import { describe, expect, it } from 'vitest';
import { CatalogError } from './client';
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
  it('never repeats what cannot change by asking again', () => {
    for (const kind of ['rate-limited', 'query', 'invalid-response'] as const) {
      expect(shouldRetry(0, new CatalogError(kind, kind))).toBe(false);
    }
  });

  it('retries a network or server failure once', () => {
    const offline = new CatalogError('unavailable', 'offline');
    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(1, offline)).toBe(false);
  });
});
