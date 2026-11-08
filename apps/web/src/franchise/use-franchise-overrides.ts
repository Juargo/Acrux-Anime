import type { FranchiseOverride } from '@acrux/domain';
import { useQuery } from '@tanstack/react-query';
import { fetchFranchiseOverrides } from '../franchise-overrides-api';

export const OVERRIDES_KEY = ['franchise-overrides'] as const;
const NONE: readonly FranchiseOverride[] = [];

// The table changes a few times a week; the API's CDN keeps it five minutes.
export const overridesQuery = (fetchFn: typeof fetch) => ({
  queryKey: OVERRIDES_KEY,
  queryFn: () => fetchFranchiseOverrides(fetchFn),
  staleTime: 10 * 60 * 1000,
});

/**
 * The curator table every grouping applies first (RF-60), or undefined while it loads. If it
 * cannot be read, grouping goes on with automatic grouping alone rather than blocking the app.
 */
export function useFranchiseOverrides(
  fetchFn: typeof fetch = fetch,
): readonly FranchiseOverride[] | undefined {
  const query = useQuery(overridesQuery(fetchFn));
  return query.data ?? (query.isError ? NONE : undefined);
}

// A short key for queries whose result depends on the table.
export function overridesVersion(overrides: readonly FranchiseOverride[] | undefined): string {
  if (!overrides) return 'loading';
  // ISO times sort as text.
  const latest =
    overrides
      .map((row) => row.updatedAt)
      .sort()
      .at(-1) ?? '';
  return `${overrides.length}:${latest}`;
}
