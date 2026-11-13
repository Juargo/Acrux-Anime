import { QueryClient } from '@tanstack/react-query';
import { CatalogError } from './client';

// Only in memory: no persister, so nothing from the catalog reaches localStorage or
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

// Rate limits and malformed answers will not improve by asking again; a network or server
// failure may.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof CatalogError && error.kind !== 'unavailable') return false;
  return failureCount < 1;
}
