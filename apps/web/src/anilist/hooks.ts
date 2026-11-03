import { useQuery } from '@tanstack/react-query';
import { type AniListClient, createAniListClient } from './client';
import { fetchMediaByIds } from './queries';

// One client per tab, so the X-RateLimit-Remaining pause covers every query.
const client: AniListClient = createAniListClient();

// Lists and the share card ask for their ids in one batch query (ADR-0024, rule 3).
export function useMediaByIds(ids: number[]) {
  return useQuery({
    queryKey: ['anilist', 'media', ids],
    queryFn: () => fetchMediaByIds(client, ids),
    enabled: ids.length > 0,
  });
}
