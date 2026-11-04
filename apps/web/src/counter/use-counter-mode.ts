import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { CounterMode } from './use-total-counter';

const MODE_KEY = ['me', 'counter-mode'] as const;

/**
 * How the counter counts, shared by the header counter and "Mi lista" (RNF-42): the profile's
 * value until the switch changes it in this session.
 */
export function useCounterMode(initial: CounterMode) {
  const queryClient = useQueryClient();
  const mode =
    useQuery({
      queryKey: MODE_KEY,
      queryFn: () => initial,
      initialData: initial,
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: Number.POSITIVE_INFINITY,
    }).data ?? initial;
  const setMode = useCallback(
    (next: CounterMode) => queryClient.setQueryData<CounterMode>(MODE_KEY, next),
    [queryClient],
  );
  return [mode, setMode] as const;
}
