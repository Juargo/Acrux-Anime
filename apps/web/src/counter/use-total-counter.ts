import { countCompleteFranchises, countSeenEntries, groupFranchises } from '@acrux/domain';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { CatalogMedia } from '../anilist/catalog';
import type { AniListClient } from '../anilist/client';
import { crawlFranchises } from '../anilist/franchise';
import { catalogEntries } from '../catalog/items';
import { useMarks } from '../catalog/use-franchise-marks';
import type { Profile } from '../profile-api';

export type CounterMode = Profile['counterMode'];

interface Crawled {
  media: Map<number, CatalogMedia>;
  // Ids already asked for, known to AniList or not, so none is asked for twice.
  requested: Set<number>;
  // Ids found by a crawl that ran out of requests; the next crawl continues from them.
  pending: Set<number>;
}

const empty = (): Crawled => ({ media: new Map(), requested: new Set(), pending: new Set() });

/**
 * The total counter (RF-24, RDI-32). By entries it reads the marks alone; by franchises it
 * groups the franchises of every seen entry, crawled from AniList once and kept for the session,
 * so a new mark only crawls the entries not known yet. undefined until it can count.
 */
export function useTotalCounter(options: {
  mode: CounterMode;
  client: AniListClient;
  getToken: () => Promise<string | null>;
  fetchFn: typeof fetch;
}): number | undefined {
  const { mode, client, getToken, fetchFn } = options;
  const marks = useMarks(getToken, fetchFn);
  const [crawled, setCrawled] = useState(empty);

  const missing = useMemo(() => {
    const seen = (marks.data ?? []).filter((mark) => mark.status === 'seen');
    const wanted = new Set([...seen.map((mark) => mark.anilistId), ...crawled.pending]);
    return [...wanted].filter((id) => !crawled.requested.has(id)).sort((a, b) => a - b);
  }, [marks.data, crawled]);

  const crawl = useQuery({
    queryKey: ['anilist', 'counter-franchises', missing],
    queryFn: () => crawlFranchises(client, missing),
    enabled: mode === 'franchise' && missing.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    const result = crawl.data;
    if (!result) return;
    setCrawled((previous) => {
      const media = new Map(previous.media);
      for (const item of result.media) media.set(item.id, item);
      const requested = new Set([...previous.requested, ...result.requested]);
      const pending = new Set(
        [...previous.pending, ...result.pending].filter((id) => !requested.has(id)),
      );
      return { media, requested, pending };
    });
  }, [crawl.data]);

  const franchises = useMemo(
    () => groupFranchises(catalogEntries([...crawled.media.values()]).entries, []),
    [crawled.media],
  );

  if (!marks.data) return undefined;
  if (mode === 'entry') return countSeenEntries(marks.data);
  // Before the first crawl lands there is nothing to count from yet.
  if (crawled.requested.size === 0 && missing.length > 0) return undefined;
  return countCompleteFranchises(franchises, marks.data, new Date().toISOString());
}
