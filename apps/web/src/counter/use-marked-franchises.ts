import { type Franchise, groupFranchises } from '@acrux/domain';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { catalogEntries } from '../catalog/items';
import { useMarks } from '../catalog/use-franchise-marks';
import type { CatalogAnime, CatalogClient } from '../catalog-source/client';
import { crawlFranchises } from '../catalog-source/franchise';
import { useFranchiseOverrides } from '../franchise/use-franchise-overrides';
import type { MarkDto } from '../marks-api';

interface Crawled {
  items: Map<number, CatalogAnime>;
  // Their neighbours one hop away, for titles and covers.
  related: Map<number, CatalogAnime>;
  // Ids already asked for, known to the catalog or not, so none is asked for twice.
  requested: Set<number>;
  // Ids found by a crawl that ran out of requests; the next crawl continues from them.
  pending: Set<number>;
}

// Kept in the query cache, so the counter and the list share one crawl for the session.
const STORE_KEY = ['catalog', 'marked-franchises'] as const;
const empty = (): Crawled => ({
  items: new Map(),
  related: new Map(),
  requested: new Set(),
  pending: new Set(),
});

function merge(previous: Crawled, result: Awaited<ReturnType<typeof crawlFranchises>>): Crawled {
  const items = new Map(previous.items);
  for (const item of result.items) items.set(item.id, item);
  const related = new Map(previous.related);
  for (const item of result.related) related.set(item.id, item);
  const requested = new Set([...previous.requested, ...result.requested]);
  const pending = new Set(
    [...previous.pending, ...result.pending].filter((id) => !requested.has(id)),
  );
  return { items, related, requested, pending };
}

export interface MarkedFranchises {
  // undefined until the marks load.
  marks: MarkDto[] | undefined;
  // The franchises of every marked entry crawled so far, grouped as the catalog does.
  franchises: Franchise[];
  // Anime behind each known id, for titles and covers.
  known: Map<number, CatalogAnime>;
  // False while marked entries wait for their first crawl.
  ready: boolean;
  // Loading the marks, or the first crawl, failed.
  failed: boolean;
  retry: () => void;
}

export interface CrawledFranchises {
  // The franchises of every crawled id, grouped as the catalog does.
  franchises: Franchise[];
  // Anime behind each known id, for titles and covers.
  known: Map<number, CatalogAnime>;
  // False while the given marks wait for their first crawl.
  ready: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * The franchises behind some marks, crawled from the catalog once and kept under `storeKey`
 * for the session; later calls only ask for the ids not known yet.
 */
export function useCrawledFranchises(options: {
  client: CatalogClient;
  marks: MarkDto[] | undefined;
  crawl: boolean;
  storeKey: readonly unknown[];
  fetchFn: typeof fetch;
}): CrawledFranchises {
  const { client, marks, storeKey } = options;
  const overrides = useFranchiseOverrides(options.fetchFn);
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
    const wanted = new Set([...(marks ?? []).map((mark) => mark.animeId), ...store.pending]);
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
    const { entries, known } = catalogEntries(
      [...store.items.values()],
      [...store.related.values()],
    );
    return { franchises: groupFranchises(entries, overrides ?? []), known };
  }, [store.items, store.related, overrides]);

  // The counter waits for the curator table, so it never shows a total that then changes.
  const ready =
    marks !== undefined &&
    overrides !== undefined &&
    !(store.requested.size === 0 && missing.length > 0);
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
 * The user's marks and the franchises behind them (RDI-32, RF-27): crawled from the catalog once,
 * then only the marked ids not known yet. `crawl: false` reads the marks alone.
 */
export function useMarkedFranchises(options: {
  client: CatalogClient;
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
    fetchFn,
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
