import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createDramaClient, type DramaBrowseParams, type DramaClient } from './client';

export const defaultDramaClient: DramaClient = createDramaClient();

// Pages of 50, loaded on request; the keys start with 'dramas' so they never meet the anime's.
export function useDramas(query: DramaBrowseParams, client: DramaClient = defaultDramaClient) {
  return useInfiniteQuery({
    queryKey: ['dramas', 'browse', query],
    queryFn: ({ pageParam }) => client.browse(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
}

// The genre list barely changes: one request per session, once the filters open.
export function useDramaGenres(enabled: boolean, client: DramaClient = defaultDramaClient) {
  return useQuery({
    queryKey: ['dramas', 'genres'],
    queryFn: () => client.genres(),
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  });
}

// The dramas behind some ids, for "Mi lista" (#166). The previous answer stays while a changed
// set of ids loads, so unmarking one drama never blanks the others.
export function useDramasByIds(ids: readonly number[], client: DramaClient = defaultDramaClient) {
  const sorted = [...ids].sort((a, b) => a - b);
  return useQuery({
    queryKey: ['dramas', 'by-ids', sorted],
    queryFn: () => client.byIds(sorted),
    enabled: sorted.length > 0,
    placeholderData: keepPreviousData,
  });
}
