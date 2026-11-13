import {
  type CatalogEntry,
  type Franchise,
  type FranchiseOverride,
  franchiseProgress,
  groupFranchises,
  type Mark,
  type RelationType,
} from '@acrux/domain';
import type { CatalogAnime } from '../catalog-source/client';

export interface CatalogItem {
  rootId: number;
  title: string;
  coverUrl: string | null;
  // RF-23: a seen franchise is dimmed.
  dimmed: boolean;
  // Core and core-plus-extras ids known from the loaded pages.
  coreIds: number[];
  entryIds: number[];
}

// RF-17: English when it exists, else the title the source gives, else the Japanese one.
export const displayTitle = (anime: CatalogAnime) =>
  anime.titleEnglish || anime.title || anime.titleJapanese || '';

function toEntry(anime: CatalogAnime, relations: CatalogEntry['relations']): CatalogEntry {
  return {
    id: anime.id,
    type: 'ANIME',
    format: anime.format,
    title: displayTitle(anime),
    // The API sends a full date or null: a partial date is already null.
    startDate: anime.startDate,
    relations,
  };
}

/**
 * Catalog entries for grouping: every hit with its relations, plus its neighbours one hop
 * away (these keep no relations of their own, so grouping never walks past them), and the
 * anime behind each id. The API never sends adult titles.
 */
export function catalogEntries(
  hits: readonly CatalogAnime[],
  related: readonly CatalogAnime[] = [],
): {
  entries: CatalogEntry[];
  known: Map<number, CatalogAnime>;
} {
  const known = new Map<number, CatalogAnime>();
  const entries = new Map<number, CatalogEntry>();
  for (const neighbour of related) {
    known.set(neighbour.id, neighbour);
    entries.set(neighbour.id, toEntry(neighbour, []));
  }
  for (const hit of hits) {
    known.set(hit.id, hit);
    entries.set(
      hit.id,
      toEntry(
        hit,
        hit.relations.map((relation) => ({ type: relation.type as RelationType, id: relation.id })),
      ),
    );
  }
  return { entries: [...entries.values()], known };
}

/**
 * One item per franchise for the loaded hits, in the order of each franchise's first hit
 * (RF-14). Grouping only sees the hits and their neighbours one hop away, so an item is
 * titled and covered by the earliest entry known here, and its ids are the ones known here;
 * marking builds the whole franchise first (catalog-source/franchise.ts). The curator table (RF-60)
 * is applied first.
 */
export function toCatalogItems(
  hits: readonly CatalogAnime[],
  related: readonly CatalogAnime[],
  marks: readonly Mark[],
  now: string,
  overrides: readonly FranchiseOverride[] = [],
): CatalogItem[] {
  const { entries, known } = catalogEntries(hits, related);
  const franchiseOf = new Map<number, Franchise>();
  for (const franchise of groupFranchises(entries, overrides)) {
    for (const member of franchise.core) franchiseOf.set(member.id, franchise);
    for (const id of franchise.extras) franchiseOf.set(id, franchise);
  }

  const items = new Map<number, CatalogItem>();
  for (const hit of hits) {
    const franchise = franchiseOf.get(hit.id);
    if (!franchise || items.has(franchise.rootId)) continue;
    const root = known.get(franchise.rootId);
    const coreIds = franchise.core.map((member) => member.id);
    items.set(franchise.rootId, {
      rootId: franchise.rootId,
      title: franchise.title,
      coverUrl: root?.coverUrl ?? hit.coverUrl ?? null,
      dimmed: franchiseProgress(franchise, marks, now).state === 'seen',
      coreIds,
      entryIds: [...coreIds, ...franchise.extras],
    });
  }
  return [...items.values()];
}
