import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { overridesVersion, useFranchiseOverrides } from '../franchise/use-franchise-overrides';
import { type CatalogQuery, fetchCatalogPage, fetchGenres } from './catalog';
import { type CatalogClient, createCatalogClient } from './client';
import { fetchFranchise } from './franchise';
import { fetchAnimeByIds } from './queries';

export const defaultClient: CatalogClient = createCatalogClient();

// Lists, the share card, the curator table and the stats ask for their ids in batches of 100
// (ADR-0043). Every anime carries what the stats need: length, genres, year and format.
export function useAnimeByIds(ids: number[], client: CatalogClient = defaultClient) {
  return useQuery({
    queryKey: ['catalog', 'anime', ids],
    queryFn: () => fetchAnimeByIds(client, ids),
    enabled: ids.length > 0,
  });
}

// Pages of 50, loaded as the grid scrolls (ADR-0017: a year can hold more than a thousand).
export function useCatalog(query: CatalogQuery, client: CatalogClient = defaultClient) {
  return useInfiniteQuery({
    queryKey: ['catalog', 'browse', query],
    queryFn: ({ pageParam }) => fetchCatalogPage(client, query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
  });
}

// The genre list barely changes: one request per session, once the filters open.
export function useGenres(enabled: boolean, client: CatalogClient = defaultClient) {
  return useQuery({
    queryKey: ['catalog', 'genres'],
    queryFn: () => fetchGenres(client),
    staleTime: Number.POSITIVE_INFINITY,
    enabled,
  });
}

// The franchise detail (RF-16) builds the whole franchise from any of its entries, with the
// curator table applied first (RF-60).
export function useFranchise(
  animeId: number,
  client: CatalogClient = defaultClient,
  fetchFn: typeof fetch = fetch,
) {
  const overrides = useFranchiseOverrides(fetchFn);
  return useQuery({
    queryKey: ['catalog', 'franchise', animeId, overridesVersion(overrides)],
    queryFn: () => fetchFranchise(client, [animeId], overrides),
    enabled: Number.isInteger(animeId) && animeId > 0 && overrides !== undefined,
  });
}
