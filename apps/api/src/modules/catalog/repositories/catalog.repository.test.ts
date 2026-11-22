import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../../db/client.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import {
  type BrowseQuery,
  type CatalogAnimeInput,
  createCatalogRepository,
} from './catalog.repository.js';

// Runs against the real migrations, connected as acrux_api like the API in production.
const apiDir = fileURLToPath(new URL('../../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

const everyFormat = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'];
const all: BrowseQuery = { genres: [], formats: everyFormat, offset: 0, limit: 50 };

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL_UNPOOLED: container.getConnectionUri() },
    stdio: 'pipe',
  });
  const owner = new pg.Client({ connectionString: container.getConnectionUri() });
  await owner.connect();
  await owner.query(`ALTER ROLE acrux_api WITH LOGIN PASSWORD 'api-test'`);
  await owner.end();
  const url = new URL(container.getConnectionUri());
  url.username = 'acrux_api';
  url.password = 'api-test';
  prisma = createPrismaClient(url.toString());

  await prisma.anime.createMany({
    data: [
      {
        id: 5114,
        title: 'Fullmetal Alchemist: Brotherhood',
        titleEnglish: 'Fullmetal Alchemist: Brotherhood',
        titleJapanese: '鋼の錬金術師',
        searchText: 'fullmetal alchemist: brotherhood 鋼の錬金術師 hagane no renkinjutsushi fma',
        coverUrl: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg',
        format: 'TV',
        startDate: new Date('2009-04-05T00:00:00.000Z'),
        year: 2009,
        episodes: 64,
        durationMinutes: 24,
        genres: ['Action', 'Adventure', 'Drama'],
        members: 3_000_000,
        relations: [{ type: 'SIDE_STORY', id: 6421 }],
        detailedAt: new Date('2026-11-10T00:00:00.000Z'),
      },
      {
        id: 16498,
        title: 'Shingeki no Kyojin',
        searchText: 'shingeki no kyojin attack on titan',
        format: 'TV',
        year: 2013,
        genres: ['Action', 'Drama'],
        members: 4_000_000,
      },
      {
        id: 199,
        title: 'Sen to Chihiro no Kamikakushi',
        searchText: 'sen to chihiro no kamikakushi spirited away 100%',
        format: 'MOVIE',
        year: 2001,
        genres: ['Adventure', 'Supernatural'],
        members: 2_000_000,
      },
      {
        id: 7,
        title: 'Some Opening',
        searchText: 'some opening',
        format: 'MUSIC',
        year: 2013,
        members: 9_000_000,
      },
      {
        id: 8,
        title: 'Adult Title',
        searchText: 'adult title',
        format: 'TV',
        year: 2013,
        genres: ['Hentai'],
        members: 8_000_000,
        adult: true,
      },
      // Broken relations must not take the row away from the catalog.
      {
        id: 9,
        title: 'Broken',
        searchText: 'broken',
        format: 'OVA',
        year: 1999,
        members: 1,
        relations: { not: 'a list' },
      },
    ],
  });
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

const browseIds = async (query: Partial<BrowseQuery>) =>
  (await createCatalogRepository(prisma).browse({ ...all, ...query })).map((row) => row.id);

describe('catalog repository: browse', () => {
  it('orders by popularity and leaves out adult titles and formats not asked for', async () => {
    expect(await browseIds({})).toEqual([16498, 5114, 199, 9]);
  });

  it('returns every field of a row, with its relations', async () => {
    const [, fullmetal] = await createCatalogRepository(prisma).browse(all);
    expect(fullmetal).toEqual({
      id: 5114,
      title: 'Fullmetal Alchemist: Brotherhood',
      titleEnglish: 'Fullmetal Alchemist: Brotherhood',
      titleJapanese: '鋼の錬金術師',
      coverUrl: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg',
      format: 'TV',
      startDate: new Date('2009-04-05T00:00:00.000Z'),
      year: 2009,
      episodes: 64,
      durationMinutes: 24,
      genres: ['Action', 'Adventure', 'Drama'],
      relations: [{ type: 'SIDE_STORY', id: 6421 }],
    });
  });

  it('finds a title by any of its names, in any letter case', async () => {
    expect(await browseIds({ search: 'Attack on' })).toEqual([16498]);
    expect(await browseIds({ search: 'FMA' })).toEqual([5114]);
    expect(await browseIds({ search: '錬金術' })).toEqual([5114]);
  });

  it('treats % and _ in the name as plain characters', async () => {
    expect(await browseIds({ search: '100%' })).toEqual([199]);
    expect(await browseIds({ search: '%' })).toEqual([199]);
    expect(await browseIds({ search: '_' })).toEqual([]);
  });

  it('filters by year, by format and by any of the genres', async () => {
    expect(await browseIds({ year: 2013 })).toEqual([16498]);
    expect(await browseIds({ formats: ['MOVIE', 'OVA'] })).toEqual([199, 9]);
    expect(await browseIds({ genres: ['Supernatural', 'Drama'] })).toEqual([16498, 5114, 199]);
  });

  it('pages with offset and limit', async () => {
    expect(await browseIds({ offset: 1, limit: 2 })).toEqual([5114, 199]);
  });
});

describe('catalog repository: byIds', () => {
  it('returns the rows of any format, never adult ones', async () => {
    const rows = await createCatalogRepository(prisma).byIds([7, 8, 5114, 404]);
    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual([7, 5114]);
  });

  it('reads relations that are not a valid list as none', async () => {
    const [broken] = await createCatalogRepository(prisma).byIds([9]);
    expect(broken?.relations).toEqual([]);
  });

  it('answers an empty list without asking the database', async () => {
    expect(await createCatalogRepository(prisma).byIds([])).toEqual([]);
  });
});

describe('catalog repository: chain', () => {
  const tv = (id: number, relations: object, extra: object = {}) => ({
    id,
    title: `chain ${id}`,
    searchText: `chain ${id}`,
    format: 'TV',
    relations,
    ...extra,
  });

  beforeAll(async () => {
    await prisma.anime.createMany({
      data: [
        tv(3001, [{ type: 'SEQUEL', id: 3002 }], {
          titleEnglish: 'First season',
          coverUrl: 'https://cdn.myanimelist.net/images/anime/3001.jpg',
          startDate: new Date('2013-04-07T00:00:00.000Z'),
          year: 2013,
          genres: ['Action'],
        }),
        tv(3002, [
          { type: 'PREQUEL', id: 3001 },
          { type: 'SEQUEL', id: 3003 },
          { type: 'SIDE_STORY', id: 3010 },
        ]),
        tv(3003, [
          { type: 'PREQUEL', id: 3002 },
          { type: 'SEQUEL', id: 3004 },
          { type: 'SEQUEL', id: 3005 },
          { type: 'SEQUEL', id: 3999 },
        ]),
        // A music video and an adult title belong to the chain's edge, never to its path.
        tv(3004, [{ type: 'SEQUEL', id: 3006 }], { format: 'MUSIC' }),
        tv(3005, [{ type: 'SEQUEL', id: 3007 }], { adult: true }),
        tv(3006, []),
        tv(3007, []),
        tv(3010, [{ type: 'SEQUEL', id: 3011 }]),
        tv(3011, []),
      ],
    });
  });

  const chainIds = async (ids: number[], limit = 100) =>
    (await createCatalogRepository(prisma).chain(ids, limit)).map((row) => row.id);

  it('follows sequels and prequels however far, without the ids asked for', async () => {
    expect(await chainIds([3003])).toEqual([3001, 3002, 3004]);
    expect(await chainIds([3001, 3003])).toEqual([3002, 3004]);
  });

  it('gives each row as the catalog does', async () => {
    const [first] = await createCatalogRepository(prisma).chain([3002], 1);
    expect(first).toEqual({
      id: 3001,
      title: 'chain 3001',
      titleEnglish: 'First season',
      titleJapanese: null,
      coverUrl: 'https://cdn.myanimelist.net/images/anime/3001.jpg',
      format: 'TV',
      startDate: new Date('2013-04-07T00:00:00.000Z'),
      year: 2013,
      episodes: null,
      durationMinutes: null,
      genres: ['Action'],
      relations: [{ type: 'SEQUEL', id: 3002 }],
    });
  });

  it('survives relations that are not a valid list and ids the table lacks', async () => {
    expect(await chainIds([9, 404])).toEqual([]);
  });

  it('answers an empty list without asking the database', async () => {
    expect(await createCatalogRepository(prisma).chain([], 100)).toEqual([]);
  });
});

describe('catalog repository: genres', () => {
  it('lists the genres of the titles the catalog shows, in order', async () => {
    expect(await createCatalogRepository(prisma).genres()).toEqual([
      'Action',
      'Adventure',
      'Drama',
      'Supernatural',
    ]);
  });
});

describe('catalog repository: franchises', () => {
  const entry = (id: number, extra: object = {}) => ({
    id,
    title: `franchise ${id}`,
    searchText: `franchise ${id}`,
    format: 'TV',
    members: 1,
    ...extra,
  });
  const idsIn = async (years?: number[]) =>
    (await createCatalogRepository(prisma).browse({ ...all, ...(years ? { years } : {}) }))
      .map((row) => row.id)
      .filter((id) => id >= 8000 && id < 9000)
      .sort((a, b) => a - b);

  beforeAll(async () => {
    await prisma.anime.createMany({
      data: [
        // A franchise of 2016 with a later season and an extra, one of 2016 alone, one of 1998,
        // an adult title of 2016 and a row nothing has computed yet.
        entry(8001, { year: 2016, franchiseRootId: 8001, franchiseYear: 2016 }),
        entry(8002, { year: 2019, franchiseRootId: 8001, franchiseYear: 2016 }),
        entry(8003, { year: 2020, franchiseRootId: 8001, franchiseYear: 2016 }),
        entry(8004, { year: 2016, franchiseRootId: 8004, franchiseYear: 2016 }),
        entry(8005, { year: 1998, franchiseRootId: 8005, franchiseYear: 1998 }),
        entry(8006, { year: 2016, franchiseRootId: 8006, franchiseYear: 2016, adult: true }),
        entry(8007, { year: 2016 }),
      ],
    });
  });

  it('keeps the anime whose franchise first released in one of the years', async () => {
    expect(await idsIn([2016])).toEqual([8001, 8002, 8003, 8004]);
    expect(await idsIn([1998, 2016])).toEqual([8001, 8002, 8003, 8004, 8005]);
    expect(await idsIn([2010])).toEqual([]);
  });

  it('leaves the year of the anime itself out of the filter', async () => {
    expect(await idsIn([2019])).toEqual([]);
    const own = await createCatalogRepository(prisma).browse({ ...all, year: 2019 });
    expect(own.map((row) => row.id)).toContain(8002);
  });

  it('shows every franchise year without the filter', async () => {
    expect(await idsIn()).toEqual([8001, 8002, 8003, 8004, 8005, 8007]);
  });

  it('counts each franchise once per year, oldest year first, without adult or unset rows', async () => {
    const years = await createCatalogRepository(prisma).franchiseYears();
    expect(years).toEqual([
      { year: 1998, franchises: 1 },
      { year: 2016, franchises: 2 },
    ]);
  });
});

describe('catalog repository: knowsName', () => {
  it('tells whether any anime has the text in a name, in any letter case', async () => {
    const repository = createCatalogRepository(prisma);
    expect(await repository.knowsName('Attack On')).toBe(true);
    expect(await repository.knowsName('frieren')).toBe(false);
  });

  it('counts the titles the catalog never shows', async () => {
    expect(await createCatalogRepository(prisma).knowsName('adult title')).toBe(true);
  });

  it('treats % and _ in the name as plain characters', async () => {
    const repository = createCatalogRepository(prisma);
    expect(await repository.knowsName('100%')).toBe(true);
    expect(await repository.knowsName('s_n to')).toBe(false);
  });
});

// The writing side (ADR-0043, point 3). These run last: they change the rows above.
describe('catalog repository: store', () => {
  const input = (id: number, extra: Partial<CatalogAnimeInput> = {}): CatalogAnimeInput => ({
    id,
    title: `Anime ${id}`,
    titleEnglish: null,
    titleJapanese: null,
    searchText: `anime ${id}`,
    coverUrl: null,
    format: 'TV',
    startDate: null,
    year: 2020,
    episodes: 12,
    durationMinutes: 24,
    genres: ['Action'],
    members: 10,
    adult: false,
    ...extra,
  });
  const stored = (id: number) => prisma.anime.findUniqueOrThrow({ where: { id } });

  it('tells which anime have their detail read, adult titles included', async () => {
    const state = await createCatalogRepository(prisma).detailState([5114, 16498, 8, 404]);
    expect([...state].sort(([a], [b]) => a - b)).toEqual([
      [8, false],
      [5114, true],
      [16498, false],
    ]);
  });

  it('creates new rows and refreshes the list fields without touching the relations', async () => {
    const repository = createCatalogRepository(prisma);
    const detailedAt = (await stored(5114)).detailedAt;
    await repository.saveListed([
      input(1001),
      input(5114, { title: 'FMA: Brotherhood', searchText: 'fma: brotherhood', members: 5 }),
    ]);

    expect(await stored(1001)).toMatchObject({
      title: 'Anime 1001',
      detailedAt: null,
      relations: [],
    });
    expect(await stored(5114)).toMatchObject({
      title: 'FMA: Brotherhood',
      members: 5,
      relations: [{ type: 'SIDE_STORY', id: 6421 }],
      detailedAt,
    });
    expect(await browseIds({ search: 'fma: bro' })).toEqual([5114]);
  });

  it('stores a detail and queues again the anime it points to that do not point back', async () => {
    const repository = createCatalogRepository(prisma);
    // 2001 knows 2003 already; 2002 was read before 2003 existed.
    await repository.saveDetailed(input(2001, { relations: [{ type: 'SEQUEL', id: 2003 }] }));
    await repository.saveDetailed(input(2002, { relations: [] }));

    await repository.saveDetailed(
      input(2003, {
        relations: [
          { type: 'PREQUEL', id: 2001 },
          { type: 'PREQUEL', id: 2002 },
        ],
      }),
    );

    expect((await stored(2003)).relations).toEqual([
      { type: 'PREQUEL', id: 2001 },
      { type: 'PREQUEL', id: 2002 },
    ]);
    expect((await stored(2003)).detailedAt).not.toBeNull();
    expect((await stored(2001)).detailedAt).not.toBeNull();
    expect((await stored(2002)).detailedAt).toBeNull();
  });

  it('marks an anime the source no longer has as read, keeping its row', async () => {
    const repository = createCatalogRepository(prisma);
    await repository.markChecked(16498);
    await repository.markChecked(404);
    expect(await stored(16498)).toMatchObject({ title: 'Shingeki no Kyojin' });
    expect((await stored(16498)).detailedAt).not.toBeNull();
  });

  it('stores the openings of a detail, and a list read later leaves them alone', async () => {
    const repository = createCatalogRepository(prisma);
    const openings = [
      { title: 'again', artist: 'YUI', episodes: '1-14' },
      { title: 'Period', artist: null, episodes: null },
    ];
    await repository.saveDetailed(input(9301, { openings }));
    await repository.saveDetailed(input(9302));
    await repository.saveListed([input(9301, { title: 'Renamed' }), input(9303)]);
    await prisma.anime.create({
      data: { id: 9304, title: 'x', searchText: 'x', adult: true, openings },
    });
    await prisma.anime.create({
      data: { id: 9305, title: 'y', searchText: 'y', openings: { not: 'a list' } },
    });

    const read = await repository.openings([9305, 9304, 9303, 9302, 9301, 404]);
    expect(read.sort((a, b) => a.animeId - b.animeId)).toEqual([
      { animeId: 9301, openings },
      // A detail always states its openings; an anime only listed was never read for them.
      { animeId: 9302, openings: [] },
      { animeId: 9303, openings: null },
      // Openings in an unexpected shape read as none, so nothing asks for them forever.
      { animeId: 9305, openings: [] },
    ]);
    expect(await repository.openings([])).toEqual([]);
  });

  it('gives an anime the source no longer has no openings, keeping the ones it had', async () => {
    const repository = createCatalogRepository(prisma);
    const openings = [{ title: 'again', artist: 'YUI', episodes: null }];
    await repository.saveListed([input(9310)]);
    await repository.saveDetailed(input(9311, { openings }));
    await repository.markChecked(9310);
    await repository.markChecked(9311);

    const read = await repository.openings([9310, 9311]);
    expect(read.sort((a, b) => a.animeId - b.animeId)).toEqual([
      { animeId: 9310, openings: [] },
      { animeId: 9311, openings },
    ]);
  });

  it('reads next the anime never read, most popular first, then the oldest reads', async () => {
    const repository = createCatalogRepository(prisma);
    await prisma.anime.deleteMany();
    const old = new Date('2026-01-01T00:00:00.000Z');
    const recent = new Date('2026-06-01T00:00:00.000Z');
    await prisma.anime.createMany({
      data: [
        { id: 1, title: 'a', searchText: 'a', format: 'TV', members: 5, detailedAt: recent },
        { id: 2, title: 'b', searchText: 'b', format: 'TV', members: 1 },
        { id: 3, title: 'c', searchText: 'c', format: null, members: 9 },
        { id: 4, title: 'd', searchText: 'd', format: 'MOVIE', members: 3, detailedAt: old },
        { id: 5, title: 'e', searchText: 'e', format: 'TV', members: 99, adult: true },
        { id: 6, title: 'f', searchText: 'f', format: 'MUSIC', members: 99 },
        { id: 7, title: 'g', searchText: 'g', format: 'PV', members: 99 },
        { id: 8, title: 'h', searchText: 'h', format: 'CM', members: 99 },
      ],
    });
    expect(await repository.nextToDetail(10)).toEqual([3, 2, 4, 1]);
    expect(await repository.nextToDetail(2)).toEqual([3, 2]);
  });
});

// What the recompute step of the load job reads and writes, as the role it runs as.
describe('catalog repository: franchise store, as acrux_catalog', () => {
  let catalog: PrismaClient;

  beforeAll(async () => {
    const owner = new pg.Client({ connectionString: container.getConnectionUri() });
    await owner.connect();
    await owner.query(`ALTER ROLE acrux_catalog WITH LOGIN PASSWORD 'catalog-test'`);
    await owner.query(`INSERT INTO "franchise_override" ("anime_id", "franchise_root_id", "role")
      VALUES (9002, 9001, 'core')`);
    await owner.end();
    const url = new URL(container.getConnectionUri());
    url.username = 'acrux_catalog';
    url.password = 'catalog-test';
    catalog = createPrismaClient(url.toString());
    await prisma.anime.createMany({
      data: [
        { id: 9001, title: 'a', searchText: 'a', format: 'TV', year: 2000 },
        {
          id: 9002,
          title: 'b',
          searchText: 'b',
          format: 'TV',
          startDate: new Date('2003-05-01T00:00:00.000Z'),
          relations: [{ type: 'PREQUEL', id: 9001 }],
          franchiseRootId: 1,
          franchiseYear: 1999,
        },
        { id: 9003, title: 'c', searchText: 'c', format: 'TV', adult: true },
        { id: 9004, title: 'd', searchText: 'd', format: 'TV', relations: { not: 'a list' } },
      ],
    });
  });

  afterAll(async () => {
    await catalog?.$disconnect();
  });

  it('reads the anime the catalog shows with their franchise and relations, and the curator rows', async () => {
    const repository = createCatalogRepository(catalog);
    const rows = (await repository.franchiseSources()).filter((row) => row.id >= 9000);
    expect(rows.sort((a, b) => a.id - b.id)).toEqual([
      {
        id: 9001,
        format: 'TV',
        startDate: null,
        year: 2000,
        relations: [],
        franchiseRootId: null,
        franchiseYear: null,
      },
      {
        id: 9002,
        format: 'TV',
        startDate: new Date('2003-05-01T00:00:00.000Z'),
        year: null,
        relations: [{ type: 'PREQUEL', id: 9001 }],
        franchiseRootId: 1,
        franchiseYear: 1999,
      },
      {
        id: 9004,
        format: 'TV',
        startDate: null,
        year: null,
        relations: [],
        franchiseRootId: null,
        franchiseYear: null,
      },
    ]);
    const overrides = await repository.overrides();
    expect(overrides).toEqual([
      expect.objectContaining({ animeId: 9002, franchiseRootId: 9001, role: 'core' }),
    ]);
  });

  it('stores the given franchises, nulls included, and leaves every other row alone', async () => {
    const repository = createCatalogRepository(catalog);
    await repository.saveFranchises([
      { id: 9001, rootId: 9001, year: 2000 },
      { id: 9002, rootId: null, year: null },
    ]);
    const stored = await prisma.anime.findMany({
      where: { id: { in: [9001, 9002, 9003, 9004] } },
      select: { id: true, franchiseRootId: true, franchiseYear: true },
      orderBy: { id: 'asc' },
    });
    expect(stored).toEqual([
      { id: 9001, franchiseRootId: 9001, franchiseYear: 2000 },
      { id: 9002, franchiseRootId: null, franchiseYear: null },
      { id: 9003, franchiseRootId: null, franchiseYear: null },
      { id: 9004, franchiseRootId: null, franchiseYear: null },
    ]);
  });

  it('writes nothing for an empty list', async () => {
    await expect(createCatalogRepository(catalog).saveFranchises([])).resolves.toBeUndefined();
  });
});
