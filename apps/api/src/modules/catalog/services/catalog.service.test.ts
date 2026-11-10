import { describe, expect, it } from 'vitest';
import type {
  AnimeRow,
  BrowseQuery,
  CatalogRepository,
  Relation,
} from '../repositories/catalog.repository.js';
import { CATALOG_PAGE_SIZE, createCatalogService } from './catalog.service.js';

// The catalog served from our own table (ADR-0043): pages bring their neighbours one hop
// away, and a franchise is crawled on the server along sequels and prequels.
function anime(id: number, relations: Relation[] = [], extra: Partial<AnimeRow> = {}): AnimeRow {
  return {
    id,
    title: `Anime ${id}`,
    titleEnglish: null,
    titleJapanese: null,
    coverUrl: null,
    format: 'TV',
    startDate: null,
    year: null,
    episodes: null,
    durationMinutes: null,
    genres: [],
    relations,
    ...extra,
  };
}

function fakeRepository(rows: AnimeRow[]) {
  const browsed: BrowseQuery[] = [];
  const asked: number[][] = [];
  const repository: CatalogRepository = {
    browse: async (query) => {
      browsed.push(query);
      return rows.slice(query.offset, query.offset + query.limit);
    },
    byIds: async (ids) => {
      asked.push([...ids]);
      return rows.filter((row) => ids.includes(row.id));
    },
    genres: async () => ['Action', 'Drama'],
  };
  return { repository, browsed, asked };
}

const filters = { genres: [], formats: ['TV'] };
const ids = (rows: AnimeRow[]) => rows.map((row) => row.id);

describe('browse', () => {
  it('gives one page with the neighbours one hop away that the page lacks', async () => {
    const rows = [
      anime(1, [
        { type: 'SEQUEL', id: 2 },
        { type: 'SIDE_STORY', id: 30 },
      ]),
      anime(2, [{ type: 'PREQUEL', id: 1 }]),
      anime(30),
    ];
    const { repository } = fakeRepository(rows);
    const service = createCatalogService({
      ...repository,
      browse: async () => rows.slice(0, 2),
    });
    const page = await service.browse(filters, 1);
    expect(ids(page.items)).toEqual([1, 2]);
    expect(ids(page.related)).toEqual([30]);
    expect(page.nextPage).toBeNull();
  });

  it('asks for one row more than the page to know whether another page follows', async () => {
    const rows = Array.from({ length: CATALOG_PAGE_SIZE * 2 }, (_, index) => anime(index + 1));
    const { repository, browsed } = fakeRepository(rows);
    const service = createCatalogService(repository);

    const first = await service.browse(filters, 1);
    expect(first.items).toHaveLength(CATALOG_PAGE_SIZE);
    expect(first.nextPage).toBe(2);

    const second = await service.browse(filters, 2);
    expect(second.items[0]?.id).toBe(CATALOG_PAGE_SIZE + 1);
    expect(second.nextPage).toBeNull();
    expect(browsed).toEqual([
      { ...filters, offset: 0, limit: CATALOG_PAGE_SIZE + 1 },
      { ...filters, offset: CATALOG_PAGE_SIZE, limit: CATALOG_PAGE_SIZE + 1 },
    ]);
  });
});

describe('franchises', () => {
  it('follows sequels and prequels to both ends of the chain', async () => {
    const { repository } = fakeRepository([
      anime(1, [{ type: 'SEQUEL', id: 2 }]),
      anime(2, [
        { type: 'PREQUEL', id: 1 },
        { type: 'SEQUEL', id: 3 },
      ]),
      anime(3, [{ type: 'PREQUEL', id: 2 }]),
      anime(9),
    ]);
    const result = await createCatalogService(repository).franchises([2]);
    expect(ids(result.items).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(result).toMatchObject({ related: [], missing: [], pending: [] });
  });

  it('brings side stories and spin-offs as related, without following them', async () => {
    const { repository } = fakeRepository([
      anime(1, [
        { type: 'SIDE_STORY', id: 10 },
        { type: 'SPIN_OFF', id: 20 },
      ]),
      anime(10, [{ type: 'SEQUEL', id: 11 }]),
      anime(11),
      anime(20),
    ]);
    const result = await createCatalogService(repository).franchises([1]);
    expect(ids(result.items)).toEqual([1]);
    expect(ids(result.related).sort((a, b) => a - b)).toEqual([10, 20]);
  });

  it('does not follow the relations of a music video', async () => {
    const { repository } = fakeRepository([
      anime(1, [{ type: 'SEQUEL', id: 2 }]),
      anime(2, [{ type: 'SEQUEL', id: 3 }], { format: 'MUSIC' }),
      anime(3),
    ]);
    const result = await createCatalogService(repository).franchises([1]);
    expect(ids(result.items).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('reports the ids the catalog does not hold, asking for each only once', async () => {
    const { repository, asked } = fakeRepository([
      anime(1, [{ type: 'SEQUEL', id: 404 }]),
      anime(5, [{ type: 'PREQUEL', id: 404 }]),
    ]);
    const result = await createCatalogService(repository).franchises([1, 5, 7, 7]);
    expect(ids(result.items).sort((a, b) => a - b)).toEqual([1, 5]);
    expect(result.missing.sort((a, b) => a - b)).toEqual([7, 404]);
    expect(asked.flat().filter((id) => id === 404)).toHaveLength(1);
  });

  it('stops at the entry limit and returns the ids it had no room for', async () => {
    const { repository } = fakeRepository([
      anime(1, [{ type: 'SEQUEL', id: 2 }]),
      anime(2, [{ type: 'SEQUEL', id: 3 }]),
      anime(3, [{ type: 'SEQUEL', id: 4 }]),
      anime(4),
    ]);
    const result = await createCatalogService(repository, { maxFranchiseEntries: 2 }).franchises([
      1,
    ]);
    expect(ids(result.items).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(result.pending).toEqual([3]);
    expect(result.related).toEqual([]);
  });
});

describe('byIds', () => {
  it('returns the rows the catalog holds', async () => {
    const { repository } = fakeRepository([anime(1), anime(2)]);
    expect(ids(await createCatalogService(repository).byIds([2, 3]))).toEqual([2]);
  });
});
