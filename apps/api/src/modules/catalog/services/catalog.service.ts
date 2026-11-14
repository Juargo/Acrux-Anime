import { type CatalogSource, SourceError } from '../adapters/myanimelist.js';
import type {
  AnimeRow,
  CatalogRepository,
  CatalogStore,
} from '../repositories/catalog.repository.js';

export const CATALOG_PAGE_SIZE = 50;

// Following sequels and prequels gives the core of a franchise (RDI-31); the grouping
// itself stays in @acrux/domain.
const CORE_RELATIONS = new Set(['SEQUEL', 'PREQUEL']);
// One request never loads more entries than this; the rest comes back as pending.
const MAX_FRANCHISE_ENTRIES = 1000;
// Fill on demand (ADR-0043, point 3): details one request may read from the source. The
// rest goes back as pending and the browser asks again.
const MAX_DETAILS_PER_REQUEST = 8;
const DETAIL_CONCURRENCY = 4;
// After a 403 or a 429 nothing asks the source for this long (S7).
const BLOCKED_PAUSE_MS = 5 * 60_000;

// What the catalog needs to complete itself from the source. Without it, the service only
// reads the table.
export interface CatalogFill {
  source: CatalogSource;
  store: CatalogStore;
  maxDetailsPerRequest?: number;
  now?: () => number;
  // A failure of the source never fails the request; it is reported here.
  onError?: (error: unknown) => void;
}

export interface BrowseFilters {
  search?: string;
  year?: number;
  genres: string[];
  formats: string[];
}

export interface CatalogPage {
  items: AnimeRow[];
  // The neighbours one hop away that the page lacks, so the browser can group it.
  related: AnimeRow[];
  nextPage: number | null;
}

export interface FranchiseCrawl {
  // The seeds and every entry reached through sequels and prequels.
  items: AnimeRow[];
  // The other neighbours of those entries: side stories, summaries, spin-offs.
  related: AnimeRow[];
  // Ids the catalog does not hold.
  missing: number[];
  // Ids left for another request because the limit was reached.
  pending: number[];
}

export interface CatalogService {
  browse(filters: BrowseFilters, page: number): Promise<CatalogPage>;
  byIds(ids: readonly number[]): Promise<AnimeRow[]>;
  franchises(seedIds: readonly number[]): Promise<FranchiseCrawl>;
  genres(): Promise<string[]>;
}

export function createCatalogService(
  repository: CatalogRepository,
  {
    maxFranchiseEntries = MAX_FRANCHISE_ENTRIES,
    fill,
  }: { maxFranchiseEntries?: number; fill?: CatalogFill } = {},
): CatalogService {
  const now = fill?.now ?? Date.now;
  const maxDetails = fill?.maxDetailsPerRequest ?? MAX_DETAILS_PER_REQUEST;
  let blockedUntil = 0;
  // Ids the table lacks that the source answered 404 for, so the same instance does not ask
  // again. Only ids a stored relation points to get here, so the set stays small.
  const gone = new Set<number>();

  function failed(error: unknown) {
    if (error instanceof SourceError && error.blocked) blockedUntil = now() + BLOCKED_PAUSE_MS;
    fill?.onError?.(error);
  }

  const canAsk = () => fill !== undefined && now() >= blockedUntil;

  // Reads from the source the detail of the ids that lack it, up to `budget.left`. Returns
  // the ids left for another request. A failure leaves the table as it is.
  // An id the table lacks is read only when `trusted` says a stored relation points to it:
  // a request can name any id, and a 404 for one of those would be asked for again forever,
  // because nothing can be stored about an anime that does not exist.
  async function ensureDetailed(
    ids: readonly number[],
    budget: { left: number },
    trusted: (id: number) => boolean,
  ) {
    if (!fill || !canAsk()) return [];
    let need: number[];
    try {
      const state = await fill.store.detailState(ids);
      need = ids.filter((id) => {
        const detailed = state.get(id);
        if (detailed === undefined) return trusted(id) && !gone.has(id);
        return !detailed;
      });
    } catch (error) {
      failed(error);
      return [];
    }
    const reading = need.slice(0, budget.left);
    budget.left -= reading.length;
    for (let start = 0; start < reading.length && canAsk(); start += DETAIL_CONCURRENCY) {
      await Promise.all(
        reading.slice(start, start + DETAIL_CONCURRENCY).map(async (id) => {
          try {
            const anime = await fill.source.detail(id);
            if (anime === null) {
              gone.add(id);
              await fill.store.markChecked(id);
            } else {
              await fill.store.saveDetailed(anime);
            }
          } catch (error) {
            failed(error);
          }
        }),
      );
    }
    return need.slice(reading.length);
  }

  // Every relation target the given rows do not include. `asked` holds the ids already
  // looked up, found or not, so none is asked for twice.
  async function neighbours(
    rows: readonly AnimeRow[],
    asked: ReadonlySet<number> = new Set(rows.map((row) => row.id)),
  ): Promise<AnimeRow[]> {
    const ids = new Set<number>();
    for (const row of rows) {
      for (const relation of row.relations) {
        if (!asked.has(relation.id)) ids.add(relation.id);
      }
    }
    return repository.byIds([...ids].slice(0, maxFranchiseEntries));
  }

  return {
    browse: async (filters, page) => {
      // One row more than the page tells whether another page follows.
      let rows = await repository.browse({
        ...filters,
        offset: (page - 1) * CATALOG_PAGE_SIZE,
        limit: CATALOG_PAGE_SIZE + 1,
      });
      // A name the table does not know is asked to the source, and what it lacks stays
      // stored. A name it knows came back empty because of the other filters: the source
      // has nothing to add, and asking would repeat on every such request.
      if (fill && canAsk() && filters.search !== undefined && page === 1 && rows.length === 0) {
        try {
          if (!(await repository.knowsName(filters.search))) {
            const found = await fill.source.search(filters.search);
            const stored = await fill.store.detailState(found.map((row) => row.id));
            const lacking = found.filter((row) => !stored.has(row.id));
            if (lacking.length > 0) {
              await fill.store.saveListed(lacking);
              rows = await repository.browse({
                ...filters,
                offset: 0,
                limit: CATALOG_PAGE_SIZE + 1,
              });
            }
          }
        } catch (error) {
          failed(error);
        }
      }
      const items = rows.slice(0, CATALOG_PAGE_SIZE);
      return {
        items,
        related: await neighbours(items),
        nextPage: rows.length > CATALOG_PAGE_SIZE ? page + 1 : null,
      };
    },

    byIds: (ids) => repository.byIds(ids),

    franchises: async (seedIds) => {
      const crawled = new Map<number, AnimeRow>();
      const asked = new Set<number>();
      const missing: number[] = [];
      const seeds = new Set(seedIds);
      let frontier = [...seeds];
      let pending: number[] = [];
      const deferred: number[] = [];
      const budget = { left: maxDetails };

      // One query per hop of the chain.
      while (frontier.length > 0) {
        const room = maxFranchiseEntries - crawled.size;
        if (room <= 0) {
          pending = frontier;
          break;
        }
        const candidates = frontier.slice(0, room);
        const next = new Set(frontier.slice(room));
        for (const id of candidates) asked.add(id);
        // An entry without its detail cannot be followed: it waits for the next request.
        // Past the seeds, every id of the frontier comes from a stored relation.
        const waiting = new Set(await ensureDetailed(candidates, budget, (id) => !seeds.has(id)));
        deferred.push(...waiting);
        const batch = candidates.filter((id) => !waiting.has(id));

        const rows = await repository.byIds(batch);
        for (const row of rows) crawled.set(row.id, row);
        missing.push(...batch.filter((id) => !crawled.has(id)));

        for (const row of rows) {
          // A music video never joins a franchise, so the chain does not go through it.
          if (row.format === 'MUSIC') continue;
          for (const relation of row.relations) {
            if (CORE_RELATIONS.has(relation.type) && !asked.has(relation.id)) {
              next.add(relation.id);
            }
          }
        }
        frontier = [...next];
      }

      const items = [...crawled.values()];
      // Pending ids belong to the chain: the next request brings them as items.
      pending = [...pending, ...deferred];
      const skipped = new Set([...asked, ...pending]);
      return { items, related: await neighbours(items, skipped), missing, pending };
    },

    genres: () => repository.genres(),
  };
}
