import { QueryClient } from '@tanstack/react-query';
import { AniListError } from './client';

// Only in memory: no persister, so nothing from AniList reaches localStorage or
// IndexedDB (ADR-0024, rule 1). A reload starts empty.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
    },
  });
}

// The client already waits out 429s; queries and malformed answers will not improve.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof AniListError && error.kind !== 'unavailable') return false;
  return failureCount < 1;
}
