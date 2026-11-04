import { countCompleteFranchises, countSeenEntries } from '@acrux/domain';
import type { AniListClient } from '../anilist/client';
import type { Profile } from '../profile-api';
import { useMarkedFranchises } from './use-marked-franchises';

export type CounterMode = Profile['counterMode'];

/**
 * The total counter (RF-24, RDI-32). By entries it reads the marks alone; by franchises it
 * counts the complete franchises of the marked entries. undefined until it can count.
 */
export function useTotalCounter(options: {
  mode: CounterMode;
  client: AniListClient;
  getToken: () => Promise<string | null>;
  fetchFn: typeof fetch;
}): number | undefined {
  const { mode, ...rest } = options;
  const marked = useMarkedFranchises({ ...rest, crawl: mode === 'franchise' });
  if (!marked.marks) return undefined;
  if (mode === 'entry') return countSeenEntries(marked.marks);
  // Nothing seen counts 0 without waiting for AniList (watching marks are crawled for the list).
  if (!marked.marks.some((mark) => mark.status === 'seen')) return 0;
  if (!marked.ready) return undefined;
  return countCompleteFranchises(marked.franchises, marked.marks, new Date().toISOString());
}
