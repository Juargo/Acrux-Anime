import {
  type CatalogEntry,
  type Franchise,
  type FranchiseOverride,
  franchiseProgress,
  groupFranchises,
  type Mark,
  type RelationType,
} from '@acrux/domain';
import type { CatalogMedia, RelatedMedia } from '../anilist/catalog';

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

// RF-17: English when it exists, else romaji.
export const displayTitle = (media: RelatedMedia) =>
  media.title.english ?? media.title.romaji ?? media.title.native ?? '';

const pad = (value: number) => String(value).padStart(2, '0');

// A partial AniList date maps to its first day; no year means not released yet.
function startDate({ startDate: date }: RelatedMedia): string | null {
  if (date.year === null) return null;
  return `${date.year}-${pad(date.month ?? 1)}-${pad(date.day ?? 1)}`;
}

// AniList also links adult entries and other media; they never reach an item.
const isCatalogMedia = (media: RelatedMedia) => media.type === 'ANIME' && media.isAdult !== true;

function toEntry(media: RelatedMedia, relations: CatalogEntry['relations']): CatalogEntry {
  return {
    id: media.id,
    type: 'ANIME',
    format: media.format,
    title: displayTitle(media),
    startDate: startDate(media),
    relations,
  };
}

/**
 * Catalog entries for grouping: every hit with its relations, plus its neighbours one hop
 * away (adult and non-anime ones left out), and the media behind each id.
 */
export function catalogEntries(medias: readonly CatalogMedia[]): {
  entries: CatalogEntry[];
  known: Map<number, RelatedMedia>;
} {
  const known = new Map<number, RelatedMedia>();
  const entries = new Map<number, CatalogEntry>();
  for (const media of medias) {
    const neighbours = media.relations.edges.filter((edge) => isCatalogMedia(edge.node));
    for (const { node } of neighbours) {
      if (!known.has(node.id)) known.set(node.id, node);
      if (!entries.has(node.id)) entries.set(node.id, toEntry(node, []));
    }
    known.set(media.id, media);
    entries.set(
      media.id,
      toEntry(
        media,
        neighbours.map((edge) => ({ type: edge.relationType as RelationType, id: edge.node.id })),
      ),
    );
  }
  return { entries: [...entries.values()], known };
}

/**
 * One item per franchise for the loaded hits, in the order of each franchise's first hit
 * (RF-14). Grouping only sees the hits and their neighbours one hop away, so an item is
 * titled and covered by the earliest entry known here, and its ids are the ones known here;
 * marking builds the whole franchise first (anilist/franchise.ts). The curator table (RF-60)
 * is applied first.
 */
export function toCatalogItems(
  hits: readonly CatalogMedia[],
  marks: readonly Mark[],
  now: string,
  overrides: readonly FranchiseOverride[] = [],
): CatalogItem[] {
  const { entries, known } = catalogEntries(hits);
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
      coverUrl: root?.coverImage?.large ?? hit.coverImage?.large ?? null,
      dimmed: franchiseProgress(franchise, marks, now).state === 'seen',
      coreIds,
      entryIds: [...coreIds, ...franchise.extras],
    });
  }
  return [...items.values()];
}
