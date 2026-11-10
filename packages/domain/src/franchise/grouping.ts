import type { CatalogEntry, CoreMember, Franchise, FranchiseOverride, RelationType } from './types';

// RDI-30: sequels and prequels form the core; side stories and summaries are extras;
// spin-offs and remakes are separate franchises linked as related; music is ignored.
// AniList has no REMAKE relation: remakes come as ALTERNATIVE.
const CORE_RELATIONS: ReadonlySet<RelationType> = new Set(['SEQUEL', 'PREQUEL']);
const EXTRA_RELATIONS: ReadonlySet<RelationType> = new Set([
  'SIDE_STORY',
  'SUMMARY',
  'COMPILATION',
]);
const RELATED_RELATIONS: ReadonlySet<RelationType> = new Set(['SPIN_OFF', 'ALTERNATIVE']);

const isEligible = (entry: CatalogEntry) => entry.type === 'ANIME' && entry.format !== 'MUSIC';

// Unreleased entries (no start date) go last; ties by lowest id.
function compareByStart(a: CatalogEntry, b: CatalogEntry): number {
  if (a.startDate !== b.startDate) {
    if (a.startDate === null) return 1;
    if (b.startDate === null) return -1;
    return a.startDate < b.startDate ? -1 : 1;
  }
  return a.id - b.id;
}

const later = (a: string, b: string) => (Date.parse(b) > Date.parse(a) ? b : a);

// Disjoint sets over entry ids. A set pinned to a curator root never merges with a set pinned
// to a different root, so the curator table always wins over the relations.
class EntrySets {
  private readonly parent = new Map<number, number>();
  private readonly pins = new Map<number, number>();

  constructor(ids: Iterable<number>) {
    for (const id of ids) this.parent.set(id, id);
  }

  find(id: number): number {
    let root = id;
    for (let next = this.parent.get(root); next !== undefined && next !== root; ) {
      root = next;
      next = this.parent.get(root);
    }
    this.parent.set(id, root);
    return root;
  }

  pin(id: number, rootId: number): void {
    const set = this.find(id);
    if (!this.pins.has(set)) this.pins.set(set, rootId);
  }

  pinOf(id: number): number | undefined {
    return this.pins.get(this.find(id));
  }

  union(a: number, b: number): void {
    const setA = this.find(a);
    const setB = this.find(b);
    if (setA === setB) return;
    const pinA = this.pins.get(setA);
    const pinB = this.pins.get(setB);
    if (pinA !== undefined && pinB !== undefined && pinA !== pinB) return;
    this.parent.set(setB, setA);
    const pin = pinA ?? pinB;
    if (pin !== undefined) this.pins.set(setA, pin);
  }
}

/**
 * Groups catalog entries into franchises (RF-14, RF-15, RDI-30). Curator overrides apply first,
 * per entry; relations to entries missing from `entries` are ignored. Pure and deterministic.
 */
export function groupFranchises(
  entries: readonly CatalogEntry[],
  overrides: readonly FranchiseOverride[],
): Franchise[] {
  const catalog = new Map(
    entries
      .filter(isEligible)
      .sort((a, b) => a.id - b.id)
      .map((entry) => [entry.id, entry]),
  );
  const overrideOf = new Map(
    [...overrides]
      .filter((row) => catalog.has(row.animeId) && catalog.has(row.franchiseRootId))
      .sort((a, b) => a.animeId - b.animeId)
      .map((row) => [row.animeId, row]),
  );
  const forcedExtra = (id: number) => overrideOf.get(id)?.role === 'extra';

  const sets = new EntrySets(catalog.keys());
  for (const row of overrideOf.values()) {
    sets.pin(row.franchiseRootId, row.franchiseRootId);
    if (row.role === 'separate') sets.pin(row.animeId, row.animeId);
  }
  for (const row of overrideOf.values()) {
    if (row.role === 'core') sets.union(row.animeId, row.franchiseRootId);
  }
  for (const entry of catalog.values()) {
    if (forcedExtra(entry.id)) continue;
    // Sorted, so the order AniList lists relations in never decides between curator roots.
    const sorted = [...entry.relations].sort((a, b) => a.id - b.id);
    for (const relation of sorted) {
      if (
        CORE_RELATIONS.has(relation.type) &&
        catalog.has(relation.id) &&
        !forcedExtra(relation.id)
      ) {
        sets.union(entry.id, relation.id);
      }
    }
  }

  const groups = new Map<number, CatalogEntry[]>();
  for (const entry of catalog.values()) {
    if (forcedExtra(entry.id)) continue;
    const key = sets.find(entry.id);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  // A lone entry reached by a side story, summary or compilation edge from another group is an
  // extra, unless the curator pinned it. Extras are one hop from a core: never followed further.
  const extraTargets = (entry: CatalogEntry) =>
    entry.relations
      .filter((relation) => EXTRA_RELATIONS.has(relation.type) && catalog.has(relation.id))
      .map((relation) => relation.id)
      .filter((id) => !forcedExtra(id) && sets.find(id) !== sets.find(entry.id));
  const reachedAsExtra = new Set(
    [...groups.values()].flat().flatMap((entry) => extraTargets(entry).map((id) => sets.find(id))),
  );
  const isLoose = (key: number) =>
    groups.get(key)?.length === 1 && sets.pinOf(key) === undefined && reachedAsExtra.has(key);

  const franchiseOf = new Map<number, Franchise>();
  const franchises: Franchise[] = [];
  const absorbed = new Set<number>();

  const buildFranchise = (key: number, members: CatalogEntry[]): Franchise => {
    const sorted = [...members].sort(compareByStart);
    const rootId = sets.pinOf(key) ?? (sorted[0] as CatalogEntry).id;
    const franchise: Franchise = {
      rootId,
      title: (catalog.get(rootId) as CatalogEntry).title,
      core: sorted.map((entry) => coreMember(entry, overrideOf.get(entry.id))),
      extras: [],
      related: [],
    };
    for (const entry of members) franchiseOf.set(entry.id, franchise);
    franchises.push(franchise);
    return franchise;
  };

  for (const [key, members] of groups) {
    if (isLoose(key)) continue;
    const franchise = buildFranchise(key, members);
    for (const entry of members) {
      for (const target of extraTargets(entry)) {
        const targetKey = sets.find(target);
        if (isLoose(targetKey) && !absorbed.has(targetKey)) {
          absorbed.add(targetKey);
          franchise.extras.push(target);
        }
      }
    }
  }
  // Loose entries only reached from other extras stand on their own.
  for (const [key, members] of groups) {
    if (isLoose(key) && !absorbed.has(key)) buildFranchise(key, members);
  }
  for (const row of overrideOf.values()) {
    const franchise = franchiseOf.get(row.franchiseRootId);
    if (row.role === 'extra' && franchise) franchise.extras.push(row.animeId);
  }

  const relate = (a: Franchise | undefined, b: Franchise | undefined) => {
    if (!a || !b || a === b) return;
    if (!a.related.includes(b.rootId)) a.related.push(b.rootId);
    if (!b.related.includes(a.rootId)) b.related.push(a.rootId);
  };
  for (const [id, franchise] of franchiseOf) {
    for (const relation of (catalog.get(id) as CatalogEntry).relations) {
      if (RELATED_RELATIONS.has(relation.type) || EXTRA_RELATIONS.has(relation.type)) {
        relate(franchise, franchiseOf.get(relation.id));
      }
    }
  }
  for (const row of overrideOf.values()) {
    if (row.role === 'separate') {
      relate(franchiseOf.get(row.animeId), franchiseOf.get(row.franchiseRootId));
    }
  }

  for (const franchise of franchises) {
    franchise.extras.sort((a, b) => a - b);
    franchise.related.sort((a, b) => a - b);
  }
  return franchises.sort((a, b) => a.rootId - b.rootId);
}

function coreMember(entry: CatalogEntry, override: FranchiseOverride | undefined): CoreMember {
  if (entry.startDate === null) return { id: entry.id, joinedAt: null };
  return {
    id: entry.id,
    joinedAt: override ? later(entry.startDate, override.updatedAt) : entry.startDate,
  };
}
