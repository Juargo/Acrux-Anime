import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AniListClient } from '../anilist/client';
import { type FranchiseEntry, fetchFranchise } from '../anilist/franchise';
import { overridesQuery } from '../franchise/use-franchise-overrides';
import { fetchMarks, type MarkDto, saveMarks } from '../marks-api';
import type { CatalogItem } from './items';

export const MARKS_KEY = ['me', 'marks'] as const;

// ADR-0030: no personal data; the sender arrives with PostHog in the SPA (#46).
export type FranchiseMarkedEvent = { status: 'seen' | null; coreSize: number };

export interface MarkMessage {
  kind: 'status' | 'alert';
  text: string;
}

function uniqueEntries(entries: FranchiseEntry[]): FranchiseEntry[] {
  const seen = new Set<number>();
  return entries.filter(({ animeId }) => !seen.has(animeId) && seen.add(animeId));
}

function upsert(marks: MarkDto[], written: MarkDto[]): MarkDto[] {
  const ids = new Set(written.map((mark) => mark.animeId));
  return [...marks.filter((mark) => !ids.has(mark.animeId)), ...written];
}

// The user's marks, shared by the catalog, the detail and the total counter.
export function useMarks(
  getToken: (() => Promise<string | null>) | undefined,
  fetchFn: typeof fetch,
) {
  return useQuery({
    queryKey: MARKS_KEY,
    queryFn: () => fetchMarks(getToken as () => Promise<string | null>, fetchFn),
    enabled: getToken !== undefined,
  });
}

/**
 * The user's marks and the one-tap toggle of a catalog franchise (RF-20, RNF-01): seen marks
 * the whole core in one batch (RDI-31); a seen franchise unmarks its core and extras. The card
 * changes at once and rolls back if building the franchise or saving fails (RNF-11).
 */
export function useFranchiseMarks(options: {
  client: AniListClient;
  getToken: (() => Promise<string | null>) | undefined;
  fetchFn: typeof fetch;
  onFranchiseMarked: ((event: FranchiseMarkedEvent) => void) | undefined;
}) {
  const { client, getToken, fetchFn, onFranchiseMarked } = options;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<MarkMessage | null>(null);

  const marks = useMarks(getToken, fetchFn);

  const toggle = useMutation({
    mutationFn: async (item: CatalogItem) => {
      const token = getToken as () => Promise<string | null>;
      // Without the curator table, marking falls back to automatic grouping (RF-60).
      const overrides = await queryClient
        .fetchQuery(overridesQuery(fetchFn))
        .catch(() => undefined);
      const franchise = await fetchFranchise(client, item.coreIds, overrides);
      if (franchise.core.length === 0) throw new Error('Franchise not found on AniList');
      const coreSize = franchise.core.length;
      if (item.dimmed) {
        const entries = uniqueEntries([
          ...franchise.core,
          ...franchise.extras,
          ...item.entryIds.map((animeId) => ({ animeId, malId: null })),
        ]);
        await saveMarks(token, { status: null, entries }, fetchFn);
        return {
          status: null,
          removed: entries.map((entry) => entry.animeId),
          written: [],
          coreSize,
        };
      }
      const written = await saveMarks(token, { status: 'seen', entries: franchise.core }, fetchFn);
      return { status: 'seen' as const, removed: [] as number[], written, coreSize };
    },
    onMutate: async (item) => {
      setMessage(null);
      await queryClient.cancelQueries({ queryKey: MARKS_KEY });
      const previous = queryClient.getQueryData<MarkDto[]>(MARKS_KEY);
      const markedAt = new Date().toISOString();
      queryClient.setQueryData<MarkDto[]>(MARKS_KEY, (current = []) =>
        item.dimmed
          ? current.filter((mark) => !item.entryIds.includes(mark.animeId))
          : upsert(
              current,
              item.coreIds.map((animeId) => ({
                animeId,
                malId: null,
                status: 'seen',
                markedAt,
              })),
            ),
      );
      return { previous };
    },
    // Only this franchise goes back: another tap may have saved meanwhile.
    onError: (_error, item, context) => {
      const touched = new Set(item.entryIds);
      const before = (context?.previous ?? []).filter((mark) => touched.has(mark.animeId));
      queryClient.setQueryData<MarkDto[]>(MARKS_KEY, (current = []) => [
        ...current.filter((mark) => !touched.has(mark.animeId)),
        ...before,
      ]);
      setMessage({ kind: 'alert', text: t('marks.saveFailed') });
    },
    onSuccess: (result, item) => {
      queryClient.setQueryData<MarkDto[]>(MARKS_KEY, (current = []) =>
        upsert(
          current.filter((mark) => !result.removed.includes(mark.animeId)),
          result.written,
        ),
      );
      if (result.status === null) {
        setMessage({ kind: 'status', text: t('marks.removed', { title: item.title }) });
      }
      onFranchiseMarked?.({ status: result.status, coreSize: result.coreSize });
    },
  });

  return {
    marks: marks.data ?? [],
    canMark: getToken !== undefined,
    toggle: (item: CatalogItem) => toggle.mutate(item),
    pendingRootId: toggle.isPending ? toggle.variables?.rootId : undefined,
    message,
  };
}
