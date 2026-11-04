import { type Franchise, groupFranchises } from '@acrux/domain';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { CatalogMedia, RelatedMedia } from '../anilist/catalog';
import type { AniListClient } from '../anilist/client';
import { crawlFranchises } from '../anilist/franchise';
import { catalogEntries } from '../catalog/items';
import { useMarks } from '../catalog/use-franchise-marks';
import type { MarkDto } from '../marks-api';

interface Crawled {
  media: Map<number, CatalogMedia>;
  // Ids already asked for, known to AniList or not, so none is asked for twice.
  requested: Set<number>;
  // Ids found by a crawl that ran out of requests; the next crawl continues from them.
  pending: Set<number>;
}

// Kept in the query cache, so the counter and the list share one crawl for the session.
const STORE_KEY = ['anilist', 'marked-franchises'] as const;
const empty = (): Crawled => ({ media: new Map(), requested: new Set(), pending: new Set() });

function merge(previous: Crawled, result: Awaited<ReturnType<typeof crawlFranchises>>): Crawled {
  const media = new Map(previous.media);
  for (const item of result.media) media.set(item.id, item);
  const requested = new Set([...previous.requested, ...result.requested]);
  const pending = new Set(
    [...previous.pending, ...result.pending].filter((id) => !requested.has(id)),
  );
  return { media, requested, pending };
}

export interface MarkedFranchises {
  // undefined until the marks load.
  marks: MarkDto[] | undefined;
  // The franchises of every marked entry crawled so far, grouped as the catalog does.
  franchises: Franchise[];
  // Media behind each known id, for titles and covers (S3: id_in batches to AniList).
  known: Map<number, RelatedMedia>;
  // False while marked entries wait for their first crawl.
  ready: boolean;
  // Loading the marks, or the first crawl, failed.
  failed: boolean;
  retry: () => void;
}

export interface CrawledFranchises {
  // The franchises of every crawled id, grouped as the catalog does.
  franchises: Franchise[];
  // Media behind each known id, for titles and covers (id_in batches to AniList).
  known: Map<number, RelatedMedia>;
  // False while the given marks wait for their first crawl.
  ready: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * The franchises behind some marks, crawled from AniList once and kept under `storeKey`
 * for the session; later calls only ask for the ids not known yet.
 */
export function useCrawledFranchises(options: {
  client: AniListClient;
  marks: MarkDto[] | undefined;
  crawl: boolean;
  storeKey: readonly unknown[];
}): CrawledFranchises {
  const { client, marks, storeKey } = options;
  const queryClient = useQueryClient();
  const store =
    useQuery({
      queryKey: storeKey,
      queryFn: empty,
      initialData: empty,
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: Number.POSITIVE_INFINITY,
    }).data ?? empty();

  const missing = useMemo(() => {
    const wanted = new Set([...(marks ?? []).map((mark) => mark.anilistId), ...store.pending]);
    return [...wanted].filter((id) => !store.requested.has(id)).sort((a, b) => a - b);
  }, [marks, store]);

  const crawl = useQuery({
    queryKey: [...storeKey, 'crawl', missing],
    queryFn: () => crawlFranchises(client, missing),
    enabled: options.crawl && missing.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    const result = crawl.data;
    if (result)
      queryClient.setQueryData<Crawled>(storeKey, (previous) => merge(previous ?? empty(), result));
  }, [crawl.data, queryClient, storeKey]);

  const grouped = useMemo(() => {
    const { entries, known } = catalogEntries([...store.media.values()]);
    return { franchises: groupFranchises(entries, []), known };
  }, [store.media]);

  const ready = marks !== undefined && !(store.requested.size === 0 && missing.length > 0);
  return {
    franchises: grouped.franchises,
    known: grouped.known,
    ready,
    failed: crawl.isError && !ready,
    retry: () => {
      if (crawl.isError) void crawl.refetch();
    },
  };
}

/**
 * The user's marks and the franchises behind them (RDI-32, RF-27): crawled from AniList once,
 * then only the marked ids not known yet. `crawl: false` reads the marks alone.
 */
export function useMarkedFranchises(options: {
  client: AniListClient;
  getToken: () => Promise<string | null>;
  fetchFn: typeof fetch;
  crawl: boolean;
}): MarkedFranchises {
  const { client, getToken, fetchFn } = options;
  const marks = useMarks(getToken, fetchFn);
  const crawled = useCrawledFranchises({
    client,
    marks: marks.data,
    crawl: options.crawl,
    storeKey: STORE_KEY,
  });
  return {
    marks: marks.data,
    franchises: crawled.franchises,
    known: crawled.known,
    ready: crawled.ready,
    failed: (marks.isError && !marks.data) || crawled.failed,
    retry: () => {
      if (marks.isError) void marks.refetch();
      crawled.retry();
    },
  };
}
