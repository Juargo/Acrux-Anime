import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../../db/client.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { type BrowseQuery, createCatalogRepository } from './catalog.repository.js';

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
