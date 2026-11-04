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
  const queryClient = useQueryClient();
  const marks = useMarks(getToken, fetchFn);
  const store =
    useQuery({
      queryKey: STORE_KEY,
      queryFn: empty,
      initialData: empty,
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: Number.POSITIVE_INFINITY,
    }).data ?? empty();

  const missing = useMemo(() => {
    const wanted = new Set([...(marks.data ?? []).map((mark) => mark.anilistId), ...store.pending]);
    return [...wanted].filter((id) => !store.requested.has(id)).sort((a, b) => a - b);
  }, [marks.data, store]);

  const crawl = useQuery({
    queryKey: ['anilist', 'marked-franchises', 'crawl', missing],
    queryFn: () => crawlFranchises(client, missing),
    enabled: options.crawl && missing.length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    const result = crawl.data;
    if (result)
      queryClient.setQueryData<Crawled>(STORE_KEY, (previous) =>
        merge(previous ?? empty(), result),
      );
  }, [crawl.data, queryClient]);

  const grouped = useMemo(() => {
    const { entries, known } = catalogEntries([...store.media.values()]);
    return { franchises: groupFranchises(entries, []), known };
  }, [store.media]);

  const ready = marks.data !== undefined && !(store.requested.size === 0 && missing.length > 0);
  return {
    marks: marks.data,
    franchises: grouped.franchises,
    known: grouped.known,
    ready,
    failed: (marks.isError && !marks.data) || (crawl.isError && !ready),
    retry: () => {
      if (marks.isError) void marks.refetch();
      if (crawl.isError) void crawl.refetch();
    },
  };
}
