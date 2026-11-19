import type {
  CuratorOverride,
  FranchiseAssignment,
  FranchiseSource,
  FranchiseStore,
} from '../repositories/catalog.repository.js';

// The part of @acrux/domain's grouping this step needs. The API is compiled on its own and
// cannot load the TypeScript sources of the domain package, so the caller hands the grouping
// in: the load job passes `groupFranchises` itself, and the grouping is never written twice.
export interface GroupingEntry {
  id: number;
  type: 'ANIME';
  format: string | null;
  title: string;
  // ISO date (YYYY-MM-DD) or null.
  startDate: string | null;
  relations: { type: string; id: number }[];
}

export interface GroupingOverride {
  animeId: number;
  franchiseRootId: number;
  role: 'core' | 'extra' | 'separate';
  updatedAt: string;
}

export interface GroupedFranchise {
  rootId: number;
  core: { id: number }[];
  extras: number[];
}

export type GroupFranchises = (
  entries: GroupingEntry[],
  overrides: GroupingOverride[],
) => GroupedFranchise[];

export interface RecomputeResult {
  // Anime read.
  examined: number;
  // Anime whose stored franchise changed and was written.
  changed: number;
}

const toOverride = (row: CuratorOverride): GroupingOverride => ({
  animeId: row.animeId,
  franchiseRootId: row.franchiseRootId,
  role: row.role,
  updatedAt: row.updatedAt.toISOString(),
});

const toEntry = (row: FranchiseSource): GroupingEntry => ({
  id: row.id,
  type: 'ANIME',
  format: row.format,
  title: '',
  startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
  relations: row.relations,
});

// The year an entry started: its start date, else the year the source gave.
const startYear = (row: FranchiseSource) => row.startDate?.getUTCFullYear() ?? row.year ?? null;

/**
 * Stores for every anime the root and the first year of its franchise (S7): the lowest year
 * among the core entries, whether the anime is a core entry or an extra. Anime in no
 * franchise (music videos) get null. Only the rows whose values changed are written.
 */
export async function recomputeFranchises({
  store,
  group,
}: {
  store: FranchiseStore;
  group: GroupFranchises;
}): Promise<RecomputeResult> {
  const [sources, overrides] = await Promise.all([store.franchiseSources(), store.overrides()]);
  const byId = new Map(sources.map((row) => [row.id, row]));

  const assigned = new Map<number, { rootId: number; year: number | null }>();
  for (const franchise of group(sources.map(toEntry), overrides.map(toOverride))) {
    const years = franchise.core.flatMap((member) => {
      const row = byId.get(member.id);
      const year = row === undefined ? null : startYear(row);
      return year === null ? [] : [year];
    });
    const year = years.length === 0 ? null : Math.min(...years);
    for (const id of [...franchise.core.map((member) => member.id), ...franchise.extras]) {
      assigned.set(id, { rootId: franchise.rootId, year });
    }
  }

  const changes: FranchiseAssignment[] = [];
  for (const row of sources) {
    const now = assigned.get(row.id) ?? { rootId: null, year: null };
    if (row.franchiseRootId !== now.rootId || row.franchiseYear !== now.year) {
      changes.push({ id: row.id, rootId: now.rootId, year: now.year });
    }
  }
  if (changes.length > 0) await store.saveFranchises(changes);
  return { examined: sources.length, changed: changes.length };
}
