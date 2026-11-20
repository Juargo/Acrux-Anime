import type {
  DramaCatalogRepository,
  DramaRow,
  Origin,
} from '../repositories/drama-catalog.repository.js';

export const DRAMA_PAGE_SIZE = 50;

export interface DramaFilters {
  origin?: Origin;
  genres: string[];
}

export interface DramaPage {
  items: DramaRow[];
  nextPage: number | null;
}

export interface DramaLookup {
  items: DramaRow[];
  // Ids the table does not serve: unknown ones, and adult ones.
  missing: number[];
}

export interface DramaService {
  browse(filters: DramaFilters, page: number): Promise<DramaPage>;
  byIds(ids: readonly number[]): Promise<DramaLookup>;
  genres(): Promise<string[]>;
}

export function createDramaService(repository: DramaCatalogRepository): DramaService {
  return {
    browse: async (filters, page) => {
      // One row more than the page tells whether another page follows.
      const rows = await repository.browse({
        ...filters,
        offset: (page - 1) * DRAMA_PAGE_SIZE,
        limit: DRAMA_PAGE_SIZE + 1,
      });
      return {
        items: rows.slice(0, DRAMA_PAGE_SIZE),
        nextPage: rows.length > DRAMA_PAGE_SIZE ? page + 1 : null,
      };
    },

    byIds: async (ids) => {
      const items = await repository.byIds(ids);
      const found = new Set(items.map((item) => item.id));
      return { items, missing: ids.filter((id) => !found.has(id)) };
    },

    genres: () => repository.genres(),
  };
}
