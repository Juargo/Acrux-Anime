import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { overridesVersion, useFranchiseOverrides } from '../franchise/use-franchise-overrides';
import { type CatalogQuery, fetchCatalogPage, fetchGenres } from './catalog';
import { type AniListClient, createAniListClient } from './client';
import { fetchFranchise } from './franchise';
import { fetchMediaByIds, fetchMediaStats } from './queries';

let rateLimitListener: ((details: { attempt: number }) => void) | undefined;

// anilist_rate_limited (ADR-0024, ADR-0030): main.tsx connects it to analytics.
export function onAniListRateLimited(listener: (details: { attempt: number }) => void) {
  rateLimitListener = listener;
}

// One client per tab, so the X-RateLimit-Remaining pause covers every query.
export const defaultClient: AniListClient = createAniListClient({
  onRateLimited: (details) => rateLimitListener?.(details),
});

// Lists and the share card ask for their ids in one batch query (ADR-0024, rule 3).
export function useMediaByIds(ids: number[], client: AniListClient = defaultClient) {
  return useQuery({
    queryKey: ['anilist', 'media', ids],
    queryFn: () => fetchMediaByIds(client, ids),
    enabled: ids.length > 0,
  });
}

// Advanced stats (RF-53): length, genres, year and format of the seen titles.
export function useMediaStats(ids: number[], client: AniListClient = defaultClient) {
  return useQuery({
    queryKey: ['anilist', 'media-stats', ids],
    queryFn: () => fetchMediaStats(client, ids),
    enabled: ids.length > 0,
  });
}

// Pages of 50, loaded as the grid scrolls (ADR-0017: a year can hold more than a thousand).
export function useCatalog(query: CatalogQuery, client: AniListClient = defaultClient) {
  return useInfiniteQuery({
    queryKey: ['anilist', 'catalog', query],
    queryFn: ({ pageParam }) => fetchCatalogPage(client, query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
}

// AniList's genre list barely changes: one request per session, once the filters open.
export function useGenres(enabled: boolean, client: AniListClient = defaultClient) {
  return useQuery({
    queryKey: ['anilist', 'genres'],
    queryFn: () => fetchGenres(client),
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  });
}

// The franchise detail (RF-16) builds the whole franchise from any of its entries, with the
// curator table applied first (RF-60).
export function useFranchise(
  animeId: number,
  client: AniListClient = defaultClient,
  fetchFn: typeof fetch = fetch,
) {
  const overrides = useFranchiseOverrides(fetchFn);
  return useQuery({
    queryKey: ['anilist', 'franchise', animeId, overridesVersion(overrides)],
    queryFn: () => fetchFranchise(client, [animeId], overrides),
    enabled: Number.isInteger(animeId) && animeId > 0 && overrides !== undefined,
  });
}
