import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FranchiseEntry } from '../anilist/franchise';
import { MARKS_KEY, type MarkMessage } from '../catalog/use-franchise-marks';
import { deleteMark, type MarkDto, putMark } from '../marks-api';

export interface EntryMarkChange {
  entry: FranchiseEntry;
  // null removes the mark of the entry.
  status: 'seen' | 'watching' | null;
}

// Replaces the mark of one entry, or removes it, leaving every other mark as it is.
function withEntryMark(marks: MarkDto[], anilistId: number, mark: MarkDto | null | undefined) {
  return [...marks.filter((current) => current.anilistId !== anilistId), ...(mark ? [mark] : [])];
}

/**
 * Marks one entry from the franchise detail (RF-16, RF-20): the row changes at once, shares the
 * marks cache with the catalog and, when saving fails, only that entry goes back (RNF-11).
 */
export function useEntryMarks(options: {
  getToken: () => Promise<string | null>;
  fetchFn: typeof fetch;
  // The install suggestion waits for the first anime marked as seen (#44).
  onMarkedSeen?: (() => void) | undefined;
}) {
  const { getToken, fetchFn, onMarkedSeen } = options;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<MarkMessage | null>(null);

  const change = useMutation({
    mutationFn: async ({ entry, status }: EntryMarkChange): Promise<MarkDto | null> => {
      if (status === null) {
        await deleteMark(getToken, entry.anilistId, fetchFn);
        return null;
      }
      return putMark(getToken, entry.anilistId, { status, malId: entry.malId }, fetchFn);
    },
    onMutate: async ({ entry, status }) => {
      setMessage(null);
      await queryClient.cancelQueries({ queryKey: MARKS_KEY });
      const previous = queryClient
        .getQueryData<MarkDto[]>(MARKS_KEY)
        ?.find((mark) => mark.anilistId === entry.anilistId);
      const optimistic: MarkDto | null = status && {
        anilistId: entry.anilistId,
        malId: entry.malId,
        status,
        markedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<MarkDto[]>(MARKS_KEY, (current = []) =>
        withEntryMark(current, entry.anilistId, optimistic),
      );
      return { previous };
    },
    onError: (_error, { entry }, context) => {
      queryClient.setQueryData<MarkDto[]>(MARKS_KEY, (current = []) =>
        withEntryMark(current, entry.anilistId, context?.previous),
      );
      setMessage({ kind: 'alert', text: t('marks.saveFailed') });
    },
    onSuccess: (written, { entry }) => {
      queryClient.setQueryData<MarkDto[]>(MARKS_KEY, (current = []) =>
        withEntryMark(current, entry.anilistId, written),
      );
      if (written?.status === 'seen') onMarkedSeen?.();
    },
  });

  return {
    change: (next: EntryMarkChange) => change.mutate(next),
    message,
  };
}
