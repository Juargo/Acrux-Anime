import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  type DramaMarkDto,
  deleteDramaMark,
  fetchDramaMarks,
  putDramaMark,
} from '../drama-marks-api';

export type DramaMarkStatus = DramaMarkDto['status'];

export interface DramaMarkChange {
  dramaId: number;
  // null removes the mark of the drama.
  status: DramaMarkStatus | null;
}

interface Options {
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
}

// Starts with 'dramas', like the catalog keys, so it never meets the anime marks.
const DRAMA_MARKS_KEY = ['dramas', 'marks'] as const;
const MUTATION_KEY = ['dramas', 'marks', 'change'] as const;

// The drama marks of the account, shared by the cards and the counter of the section.
export function useDramaMarkList({ getToken, fetchFn = fetch }: Options) {
  return useQuery({
    queryKey: DRAMA_MARKS_KEY,
    queryFn: () => fetchDramaMarks(getToken, fetchFn),
  });
}

// Replaces the mark of one drama, or removes it, leaving every other mark as it is.
function withMark(marks: DramaMarkDto[], dramaId: number, mark: DramaMarkDto | null | undefined) {
  return [...marks.filter((current) => current.dramaId !== dramaId), ...(mark ? [mark] : [])];
}

/**
 * Marks one drama from its card (#154): the card changes at once and, when saving fails, only
 * that drama goes back (RNF-11). The whole show is marked, never a season.
 */
export function useDramaMarks(options: Options) {
  const { getToken, fetchFn = fetch } = options;
  const queryClient = useQueryClient();
  const list = useDramaMarkList(options);
  const [failed, setFailed] = useState(false);

  const change = useMutation({
    mutationKey: MUTATION_KEY,
    // One at a time: a second tap on the same card is saved after the first.
    scope: { id: 'drama-marks' },
    mutationFn: async ({ dramaId, status }: DramaMarkChange): Promise<DramaMarkDto | null> => {
      if (status === null) {
        await deleteDramaMark(getToken, dramaId, fetchFn);
        return null;
      }
      return putDramaMark(getToken, dramaId, { status }, fetchFn);
    },
    onMutate: async ({ dramaId, status }) => {
      setFailed(false);
      await queryClient.cancelQueries({ queryKey: DRAMA_MARKS_KEY });
      const previous = queryClient
        .getQueryData<DramaMarkDto[]>(DRAMA_MARKS_KEY)
        ?.find((mark) => mark.dramaId === dramaId);
      const optimistic: DramaMarkDto | null = status && {
        dramaId,
        status,
        markedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<DramaMarkDto[]>(DRAMA_MARKS_KEY, (current = []) =>
        withMark(current, dramaId, optimistic),
      );
      return { previous };
    },
    onError: (_error, { dramaId }, context) => {
      queryClient.setQueryData<DramaMarkDto[]>(DRAMA_MARKS_KEY, (current = []) =>
        withMark(current, dramaId, context?.previous),
      );
      setFailed(true);
    },
    onSuccess: (written, { dramaId }) => {
      queryClient.setQueryData<DramaMarkDto[]>(DRAMA_MARKS_KEY, (current = []) =>
        withMark(current, dramaId, written),
      );
    },
    // The list is read again once nothing else is being saved, so the cards end on what the
    // API holds even when a mark was changed before the first read finished.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: DRAMA_MARKS_KEY });
      }
    },
  });

  return {
    marks: list.data,
    change: (next: DramaMarkChange) => change.mutate(next),
    failed,
  };
}
