import type { AnimeRow, CatalogRepository } from '../repositories/catalog.repository.js';

export const CATALOG_PAGE_SIZE = 50;

// Following sequels and prequels gives the core of a franchise (RDI-31); the grouping
// itself stays in @acrux/domain.
const CORE_RELATIONS = new Set(['SEQUEL', 'PREQUEL']);
// One request never loads more entries than this; the rest comes back as pending.
const MAX_FRANCHISE_ENTRIES = 1000;

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
  { maxFranchiseEntries = MAX_FRANCHISE_ENTRIES }: { maxFranchiseEntries?: number } = {},
): CatalogService {
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
      const rows = await repository.browse({
        ...filters,
        offset: (page - 1) * CATALOG_PAGE_SIZE,
        limit: CATALOG_PAGE_SIZE + 1,
      });
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
      let frontier = [...new Set(seedIds)];
      let pending: number[] = [];

      // One query per hop of the chain.
      while (frontier.length > 0) {
        const room = maxFranchiseEntries - crawled.size;
        if (room <= 0) {
          pending = frontier;
          break;
        }
        const batch = frontier.slice(0, room);
        const next = new Set(frontier.slice(room));
        for (const id of batch) asked.add(id);

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
      const skipped = new Set([...asked, ...pending]);
      return { items, related: await neighbours(items, skipped), missing, pending };
    },

    genres: () => repository.genres(),
  };
}
