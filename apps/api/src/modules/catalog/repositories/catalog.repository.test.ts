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
