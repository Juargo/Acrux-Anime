import { describe, expect, it } from 'vitest';
import { type CatalogSource, SourceError } from '../adapters/myanimelist.js';
import type {
  AnimeRow,
  BrowseQuery,
  CatalogAnimeInput,
  CatalogRepository,
  CatalogStore,
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
    knowsName: async () => false,
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

// Fill on demand (ADR-0043, point 3): what the table lacks is read from MyAnimeList when
// someone asks for it, and stays stored.
function filling(
  initial: AnimeRow[],
  options: {
    // Details the source has, by id. An id it lacks answers 404.
    details?: AnimeRow[];
    detailed?: number[];
    found?: AnimeRow[];
    fail?: SourceError;
    clock?: { now: number };
  } = {},
) {
  const rows = new Map(initial.map((row) => [row.id, row]));
  const detailed = new Set(options.detailed ?? []);
  const calls = {
    detail: [] as number[],
    search: [] as string[],
    saved: [] as number[][],
    errors: [] as unknown[],
  };
  const toInput = (row: AnimeRow): CatalogAnimeInput => ({
    ...row,
    searchText: row.title.toLowerCase(),
    members: 0,
    adult: false,
  });
  const repository: CatalogRepository = {
    browse: async (query) =>
      [...rows.values()]
        .filter((row) => !query.search || row.title.toLowerCase().includes(query.search))
        .filter(
          (row) =>
            query.genres.length === 0 || row.genres.some((genre) => query.genres.includes(genre)),
        )
        .slice(query.offset, query.offset + query.limit),
    byIds: async (ids) => [...rows.values()].filter((row) => ids.includes(row.id)),
    genres: async () => [],
    knowsName: async (search) =>
      [...rows.values()].some((row) => row.title.toLowerCase().includes(search)),
  };
  const store: CatalogStore = {
    detailState: async (ids) =>
      new Map(ids.filter((id) => rows.has(id)).map((id) => [id, detailed.has(id)])),
    saveListed: async (listed) => {
      calls.saved.push(listed.map((row) => row.id));
      for (const row of listed) rows.set(row.id, { ...row, relations: [] });
    },
    saveDetailed: async (row) => {
      rows.set(row.id, { ...row, relations: row.relations ?? [] });
      detailed.add(row.id);
    },
    markChecked: async (id) => {
      if (rows.has(id)) detailed.add(id);
    },
    nextToDetail: async () => [],
  };
  const source: CatalogSource = {
    detail: async (id) => {
      calls.detail.push(id);
      if (options.fail) throw options.fail;
      const found = options.details?.find((row) => row.id === id);
      return found ? toInput(found) : null;
    },
    search: async (name) => {
      calls.search.push(name);
      if (options.fail) throw options.fail;
      return (options.found ?? []).map(toInput);
    },
    ranking: async () => ({ items: [], hasNext: false }),
  };
  const service = createCatalogService(repository, {
    fill: {
      source,
      store,
      maxDetailsPerRequest: 2,
      now: () => options.clock?.now ?? 0,
      onError: (error) => calls.errors.push(error),
    },
  });
  return { service, calls, rows };
}

describe('franchises, filling from the source', () => {
  it('reads the detail of an entry that lacks it and follows its chain', async () => {
    const { service, calls } = filling([anime(1), anime(2)], {
      details: [anime(1, [{ type: 'SEQUEL', id: 2 }]), anime(2, [{ type: 'PREQUEL', id: 1 }])],
    });
    const result = await service.franchises([1]);
    expect(ids(result.items).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(result).toMatchObject({ missing: [], pending: [] });
    expect(calls.detail).toEqual([1, 2]);
  });

  it('brings an anime the table does not hold yet when a stored entry points to it', async () => {
    const { service, rows } = filling([anime(1, [{ type: 'SEQUEL', id: 7 }])], {
      detailed: [1],
      details: [anime(7, [{ type: 'PREQUEL', id: 1 }])],
    });
    const result = await service.franchises([1]);
    expect(ids(result.items).sort((a, b) => a - b)).toEqual([1, 7]);
    expect(result.missing).toEqual([]);
    expect(rows.has(7)).toBe(true);
  });

  // Anyone can send any id: only the table says which anime exist.
  it('does not ask the source for a requested id the table does not hold', async () => {
    const { service, calls } = filling([], { details: [anime(7)] });
    const result = await service.franchises([7]);
    expect(result).toMatchObject({ items: [], missing: [7], pending: [] });
    expect(calls.detail).toEqual([]);
  });

  it('does not ask the source for an entry whose detail is stored', async () => {
    const { service, calls } = filling([anime(1)], { detailed: [1] });
    expect(ids((await service.franchises([1])).items)).toEqual([1]);
    expect(calls.detail).toEqual([]);
  });

  it('reads only so many details per request and leaves the rest as pending', async () => {
    const { service, calls } = filling([anime(1), anime(2), anime(3)], {
      details: [anime(1), anime(2), anime(3)],
    });
    const first = await service.franchises([1, 2, 3]);
    expect(ids(first.items).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(first.pending).toEqual([3]);
    expect(first.missing).toEqual([]);

    const second = await service.franchises(first.pending);
    expect(ids(second.items)).toEqual([3]);
    expect(second.pending).toEqual([]);
    expect(calls.detail).toEqual([1, 2, 3]);
  });

  it('reports an anime the source does not have as missing and asks only once', async () => {
    const { service, calls } = filling([anime(1, [{ type: 'SEQUEL', id: 404 }])], {
      detailed: [1],
    });
    expect((await service.franchises([1])).missing).toEqual([404]);
    expect((await service.franchises([1])).missing).toEqual([404]);
    expect(calls.detail).toEqual([404]);
  });

  it('serves what the table holds when the source fails', async () => {
    const { service, calls } = filling([anime(1)], { fail: new SourceError(500, 'down') });
    const result = await service.franchises([1, 9]);
    expect(ids(result.items)).toEqual([1]);
    expect(result.missing).toEqual([9]);
    expect(result.pending).toEqual([]);
    expect(calls.detail).toEqual([1]);
    expect(calls.errors).toHaveLength(1);
  });

  it('stops asking for five minutes after the source refuses with a 429', async () => {
    const clock = { now: 1_000 };
    const { service, calls } = filling([anime(1), anime(2)], {
      fail: new SourceError(429, 'slow down'),
      clock,
    });
    await service.franchises([1]);
    await service.franchises([2]);
    await service.browse({ ...filters, search: 'nothing' }, 1);
    expect(calls.detail).toEqual([1]);
    expect(calls.search).toEqual([]);

    clock.now += 5 * 60_000;
    await service.franchises([2]);
    expect(calls.detail).toEqual([1, 2]);
  });
});

describe('browse, filling from the source', () => {
  it('asks the source for a name the table does not know and serves what it stores', async () => {
    const { service, calls, rows } = filling([anime(1)], {
      found: [anime(50, [], { title: 'Frieren' })],
    });
    const page = await service.browse({ ...filters, search: 'frieren' }, 1);
    expect(ids(page.items)).toEqual([50]);
    expect(calls.search).toEqual(['frieren']);
    expect(rows.has(50)).toBe(true);
  });

  it('does not ask the source when the table has results, has no name or is past page 1', async () => {
    const { service, calls } = filling([anime(1)]);
    await service.browse({ ...filters, search: 'anime' }, 1);
    await service.browse(filters, 1);
    await service.browse({ ...filters, search: 'nothing' }, 2);
    expect(calls.search).toEqual([]);
  });

  it('does not ask the source for a name the table knows when the filters leave no result', async () => {
    const { service, calls } = filling([anime(1, [], { title: 'Frieren', genres: ['Drama'] })], {
      found: [anime(1, [], { title: 'Frieren' })],
    });
    const page = await service.browse({ ...filters, search: 'frieren', genres: ['Sports'] }, 1);
    expect(page.items).toEqual([]);
    expect(calls.search).toEqual([]);
    expect(calls.saved).toEqual([]);
  });

  it('stores only the anime the table lacks', async () => {
    const { service, calls } = filling([anime(1)], {
      found: [anime(1), anime(50, [], { title: 'Frieren' })],
    });
    await service.browse({ ...filters, search: 'frieren' }, 1);
    expect(calls.saved).toEqual([[50]]);
  });

  it('writes nothing when the source only names anime the table already holds', async () => {
    const { service, calls } = filling([anime(1)], { found: [anime(1)] });
    const page = await service.browse({ ...filters, search: 'frieren' }, 1);
    expect(page.items).toEqual([]);
    expect(calls.search).toEqual(['frieren']);
    expect(calls.saved).toEqual([]);
  });

  it('answers an empty page when the source fails', async () => {
    const { service, calls } = filling([], { fail: new SourceError(null, 'timeout') });
    const page = await service.browse({ ...filters, search: 'frieren' }, 1);
    expect(page).toEqual({ items: [], related: [], nextPage: null });
    expect(calls.errors).toHaveLength(1);
  });
});
