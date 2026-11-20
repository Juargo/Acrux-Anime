import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import { createPrismaClient } from '../../db/client.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AnimeRow } from '../catalog/repositories/catalog.repository.js';
import type { CatalogService } from '../catalog/services/catalog.service.js';
import { createDramaCatalogRepository } from './repositories/drama-catalog.repository.js';
import { searchKey } from './search-key.js';
import { createDramaService, type DramaService } from './services/drama.service.js';

// The drama catalog (ADR-0046): public, read-only and cacheable. It runs against the real
// migrations, connected as acrux_api like the API in production, which can only SELECT.
const apiDir = fileURLToPath(new URL('../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let owner: pg.Client;
let seeder: PrismaClient;
let reader: PrismaClient;
let app: ReturnType<typeof createApp>;

const CACHE = 'public, max-age=0, s-maxage=300';

function row(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Drama ${id}`,
    searchText: `drama ${id}`,
    tvmazeUrl: `https://www.tvmaze.com/shows/${id}/drama-${id}`,
    country: 'KR',
    language: 'Korean',
    genres: ['Drama'],
    weight: 0,
    ...overrides,
  };
}

async function seed(rows: ReturnType<typeof row>[]) {
  await seeder.drama.deleteMany();
  await seeder.drama.createMany({ data: rows });
}

const ids = (body: { items: { id: number }[] }) => body.items.map((item) => item.id);

function appWith(dramas: DramaService | undefined, catalog?: CatalogService) {
  return createApp({
    ...createContainer({}),
    modules: createModules(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      catalog,
      dramas,
    ),
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL_UNPOOLED: container.getConnectionUri() },
    stdio: 'pipe',
  });
  owner = new pg.Client({ connectionString: container.getConnectionUri() });
  await owner.connect();
  await owner.query(`ALTER ROLE acrux_api WITH LOGIN PASSWORD 'api-test'`);
  seeder = createPrismaClient(container.getConnectionUri());
  const url = new URL(container.getConnectionUri());
  url.username = 'acrux_api';
  url.password = 'api-test';
  reader = createPrismaClient(url.toString());
  app = appWith(createDramaService(createDramaCatalogRepository(reader)));
}, 180_000);

afterAll(async () => {
  await reader?.$disconnect();
  await seeder?.$disconnect();
  await owner?.end();
  await container?.stop();
});

beforeEach(async () => {
  await seeder.drama.deleteMany();
});

describe('GET /api/v1/dramas', () => {
  it('lists dramas by weight, then id, to anyone and lets the CDN keep the page', async () => {
    await seed([row(3, { weight: 10 }), row(2, { weight: 80 }), row(1, { weight: 80 })]);
    const response = await request(app).get('/api/v1/dramas');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(ids(response.body)).toEqual([1, 2, 3]);
    expect(response.body.nextPage).toBeNull();
    expect(await owner.query('SELECT count(*)::int AS n FROM drama')).toMatchObject({
      rows: [{ n: 3 }],
    });
  });

  it('serves 50 dramas a page and says where the next page is', async () => {
    await seed(Array.from({ length: 51 }, (_, index) => row(index + 1, { weight: 100 - index })));
    const first = await request(app).get('/api/v1/dramas');
    expect(first.body.items).toHaveLength(50);
    expect(first.body.nextPage).toBe(2);
    const second = await request(app).get('/api/v1/dramas?page=2');
    expect(ids(second.body)).toEqual([51]);
    expect(second.body.nextPage).toBeNull();
  });

  it('gives each drama the fields the web shows, with its TVmaze url and origin', async () => {
    await seed([
      row(42806, {
        title: 'The Untamed',
        aliases: ['陈情令'],
        summary: 'The pugilist world is ruled by the Wen clan.',
        coverUrl: 'https://static.tvmaze.com/uploads/images/original_untouched/236/592104.jpg',
        tvmazeUrl: 'https://www.tvmaze.com/shows/42806/the-untamed',
        country: 'CN',
        language: 'Chinese',
        year: 2019,
        seasons: 1,
        episodes: 50,
        genres: ['Drama', 'Romance'],
        weight: 66,
        detailedAt: new Date('2026-11-10T00:00:00.000Z'),
      }),
    ]);
    const response = await request(app).get('/api/v1/dramas');
    expect(response.body.items).toEqual([
      {
        id: 42806,
        title: 'The Untamed',
        aliases: ['陈情令'],
        summary: 'The pugilist world is ruled by the Wen clan.',
        coverUrl: 'https://static.tvmaze.com/uploads/images/original_untouched/236/592104.jpg',
        tvmazeUrl: 'https://www.tvmaze.com/shows/42806/the-untamed',
        country: 'CN',
        language: 'Chinese',
        origin: 'CN',
        year: 2019,
        seasons: 1,
        episodes: 50,
        genres: ['Drama', 'Romance'],
      },
    ]);
  });

  it('serves a drama without a detail as it is: no aliases, seasons or episodes', async () => {
    await seed([row(7, { summary: null, coverUrl: null, year: null })]);
    const response = await request(app).get('/api/v1/dramas');
    expect(response.body.items[0]).toMatchObject({
      id: 7,
      aliases: [],
      seasons: null,
      episodes: null,
      summary: null,
      coverUrl: null,
      year: null,
      tvmazeUrl: 'https://www.tvmaze.com/shows/7/drama-7',
    });
  });

  describe('origin', () => {
    const rows = () => [
      row(1, { country: 'KR', language: 'Korean', weight: 90 }),
      row(2, { country: 'JP', language: 'Japanese', weight: 80 }),
      row(3, { country: 'CN', language: 'Chinese', weight: 70 }),
      row(4, { country: null, language: 'Korean', weight: 60 }),
      row(5, { country: null, language: 'Japanese', weight: 50 }),
      row(6, { country: null, language: 'Chinese', weight: 40 }),
      row(7, { country: 'US', language: 'Korean', weight: 95 }),
      row(8, { country: null, language: 'English', weight: 30 }),
      row(9, { country: 'KR', language: 'English', weight: 20 }),
    ];

    it.each([
      ['KR', [1, 4, 9]],
      ['JP', [2, 5]],
      ['CN', [3, 6]],
    ])(
      'keeps the %s dramas: by country, or by language when there is no country',
      async (origin, expected) => {
        await seed(rows());
        const response = await request(app).get(`/api/v1/dramas?origin=${origin}`);
        expect(response.status).toBe(200);
        expect(ids(response.body)).toEqual(expected);
        for (const item of response.body.items) expect(item.origin).toBe(origin);
      },
    );

    it('never gives a drama of another country to an origin, whatever its language', async () => {
      await seed(rows());
      for (const origin of ['KR', 'JP', 'CN']) {
        const response = await request(app).get(`/api/v1/dramas?origin=${origin}`);
        expect(ids(response.body)).not.toContain(7);
        expect(ids(response.body)).not.toContain(8);
      }
      const all = await request(app).get('/api/v1/dramas');
      const byId = Object.fromEntries(all.body.items.map((i: { id: number }) => [i.id, i]));
      expect(byId[7].origin).toBeNull();
      expect(byId[8].origin).toBeNull();
      expect(byId[4].origin).toBe('KR');
    });
  });

  describe('genres', () => {
    const rows = () => [
      row(1, { country: 'KR', genres: ['Drama', 'Romance'], weight: 90 }),
      row(2, { country: 'JP', language: 'Japanese', genres: ['Drama'], weight: 80 }),
      row(3, { country: 'KR', genres: ['Thriller'], weight: 70 }),
      row(4, { country: 'KR', genres: [], weight: 60 }),
    ];

    it('keeps the dramas with a genre, and with any of several as the anime catalog does', async () => {
      await seed(rows());
      const one = await request(app).get('/api/v1/dramas?genres=Romance');
      expect(ids(one.body)).toEqual([1]);
      const several = await request(app).get('/api/v1/dramas?genres=Romance,Thriller');
      expect(ids(several.body)).toEqual([1, 3]);
    });

    it('combines origin and genre', async () => {
      await seed(rows());
      const response = await request(app).get('/api/v1/dramas?origin=KR&genres=Drama');
      expect(ids(response.body)).toEqual([1]);
    });
  });

  describe('search', () => {
    const untamed = row(42806, {
      title: 'The Untamed',
      aliases: ['陈情令', 'Chén Qíng Lìng'],
      searchText: searchKey('The Untamed 陈情令 Chén Qíng Lìng'),
      country: 'CN',
      language: 'Chinese',
    });

    it('finds a drama by part of its title, whatever the case', async () => {
      await seed([untamed, row(2)]);
      expect(ids((await request(app).get('/api/v1/dramas?search=the%20UNTAMED')).body)).toEqual([
        42806,
      ]);
      expect(ids((await request(app).get('/api/v1/dramas?search=untam')).body)).toEqual([42806]);
    });

    it('finds a drama by an alias in its original script', async () => {
      await seed([untamed, row(2)]);
      const response = await request(app).get(
        `/api/v1/dramas?search=${encodeURIComponent('陈情令')}`,
      );
      expect(ids(response.body)).toEqual([42806]);
      expect(response.body.items[0].title).toBe('The Untamed');
    });

    it('ignores accents and tone marks, in the search and in the names', async () => {
      await seed([untamed, row(2)]);
      const plain = await request(app).get('/api/v1/dramas?search=Chen%20Qing%20Ling');
      expect(ids(plain.body)).toEqual([42806]);
      const marked = await request(app).get(
        `/api/v1/dramas?search=${encodeURIComponent('Chén Qíng Lìng')}`,
      );
      expect(ids(marked.body)).toEqual([42806]);
    });

    it('answers an empty page, not an error, when no name matches', async () => {
      await seed([untamed]);
      const response = await request(app).get('/api/v1/dramas?search=El%20indomable');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [], nextPage: null });
    });

    it('gives every drama that shares a title', async () => {
      await seed([
        row(1, { title: 'Boys Over Flowers', searchText: 'boys over flowers', weight: 5 }),
        row(2, { title: 'Boys Over Flowers', searchText: 'boys over flowers', weight: 9 }),
        row(3),
      ]);
      const response = await request(app).get('/api/v1/dramas?search=boys%20over%20flowers');
      expect(ids(response.body)).toEqual([2, 1]);
    });

    it('takes % and _ as plain characters', async () => {
      await seed([row(1, { title: '100% Love', searchText: '100% love' }), row(2)]);
      expect(ids((await request(app).get('/api/v1/dramas?search=%25')).body)).toEqual([1]);
      expect(ids((await request(app).get('/api/v1/dramas?search=_')).body)).toEqual([]);
    });

    it('combines with origin and genre, and never finds an adult drama', async () => {
      await seed([
        untamed,
        row(7, { title: 'Untamed Hearts', searchText: 'untamed hearts' }),
        row(8, { title: 'Untamed Nights', searchText: 'untamed nights', genres: ['Adult'] }),
      ]);
      expect(ids((await request(app).get('/api/v1/dramas?search=untamed')).body)).toEqual([
        7, 42806,
      ]);
      const korean = await request(app).get('/api/v1/dramas?search=untamed&origin=KR');
      expect(ids(korean.body)).toEqual([7]);
    });

    it('treats a blank search as no search and rejects one that is too long or repeated', async () => {
      await seed([row(1), row(2)]);
      expect(ids((await request(app).get('/api/v1/dramas?search=%20')).body)).toEqual([1, 2]);
      const long = await request(app).get(`/api/v1/dramas?search=${'a'.repeat(101)}`);
      expect(long.status).toBe(400);
      expect(long.body.code).toBe('dramas.invalid_query');
      const twice = await request(app).get('/api/v1/dramas?search=a&search=b');
      expect(twice.status).toBe(400);
    });
  });

  describe('the rows loaded before the search ignored accents', () => {
    const migration = readFileSync(
      new URL(
        '../../../prisma/migrations/20261120010000_busqueda_de_dramas_sin_tildes/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const names = [
      'the untamed 陈情令 chén qíng lìng',
      'lǜ',
      'ガール が',
      '한글 드라마',
      'crème brûlée',
    ];

    it('get the key the load and the search build, and nothing else changes', async () => {
      await seed(
        names.map((name, index) =>
          row(index + 1, { title: `Title ${name}`, aliases: [name], searchText: name }),
        ),
      );
      await owner.query(migration);
      const { rows } = await owner.query(
        'SELECT id, title, aliases, search_text FROM drama ORDER BY id',
      );
      expect(rows).toEqual(
        names.map((name, index) => ({
          id: index + 1,
          title: `Title ${name}`,
          aliases: [name],
          search_text: searchKey(name),
        })),
      );
      const found = await request(app).get('/api/v1/dramas?search=Chen%20Qing%20Ling');
      expect(ids(found.body)).toEqual([1]);
    });

    it('are left alone when run again', async () => {
      await seed([row(1, { searchText: 'chén qíng lìng' })]);
      await owner.query(migration);
      expect((await owner.query(migration)).rowCount).toBe(0);
    });
  });

  it('never serves an adult drama, with or without filters', async () => {
    await seed([
      row(1, { genres: ['Drama'], weight: 10 }),
      row(2, { genres: ['Drama', 'Adult'], weight: 99 }),
      row(3, { genres: ['Adult'], weight: 98 }),
    ]);
    expect(ids((await request(app).get('/api/v1/dramas')).body)).toEqual([1]);
    expect(ids((await request(app).get('/api/v1/dramas?genres=Adult')).body)).toEqual([]);
    expect(ids((await request(app).get('/api/v1/dramas?origin=KR&genres=Drama')).body)).toEqual([
      1,
    ]);
  });

  it.each([
    ['an origin outside KR, JP and CN', 'origin=US'],
    ['an origin in lower case', 'origin=kr'],
    ['an empty origin', 'origin='],
    ['an origin given twice', 'origin=KR&origin=JP'],
    ['an empty genre', 'genres=Drama,'],
    ['a genre that is too long', `genres=${'a'.repeat(101)}`],
    ['too many genres', `genres=${Array.from({ length: 11 }, (_, i) => `g${i}`).join(',')}`],
    ['genres given twice', 'genres=Drama&genres=Romance'],
    ['page 0', 'page=0'],
    ['a page beyond the limit', 'page=1001'],
    ['a page that is not a number', 'page=abc'],
    ['a page given twice', 'page=1&page=2'],
  ])('answers 400 to %s', async (_name, query) => {
    const response = await request(app).get(`/api/v1/dramas?${query}`);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'dramas.invalid_query' });
  });
});

describe('GET /api/v1/dramas/by-ids', () => {
  it('gives the dramas found, reports the unknown ids and hides the adult ones', async () => {
    await seed([row(1), row(2, { genres: ['Drama', 'Adult'] })]);
    const response = await request(app).get('/api/v1/dramas/by-ids?ids=1,2,3');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(ids(response.body)).toEqual([1]);
    expect(response.body.items[0].tvmazeUrl).toBe('https://www.tvmaze.com/shows/1/drama-1');
    expect(response.body.missing).toEqual([2, 3]);
  });

  it('answers 200 with everything missing, not a server error, for ids the table lacks', async () => {
    const response = await request(app).get('/api/v1/dramas/by-ids?ids=999');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], missing: [999] });
  });

  it.each([
    ['no ids', ''],
    ['empty ids', 'ids='],
    ['an id that is not a number', 'ids=1,x'],
    ['an id of 0', 'ids=0'],
    ['an id past int4', 'ids=2147483648'],
    ['ids given twice', 'ids=1&ids=2'],
    ['too many ids', `ids=${Array.from({ length: 101 }, (_, i) => i + 1).join(',')}`],
  ])('answers 400 to %s', async (_name, query) => {
    const response = await request(app).get(`/api/v1/dramas/by-ids?${query}`);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'dramas.invalid_query' });
  });
});

describe('GET /api/v1/dramas/genres', () => {
  it('lists the genres in alphabetical order, without Adult and without duplicates', async () => {
    await seed([
      row(1, { genres: ['Romance', 'Drama'] }),
      row(2, { genres: ['Drama', 'Adult', 'Horror'] }),
      row(3, { genres: ['Comedy', 'Drama'] }),
    ]);
    const response = await request(app).get('/api/v1/dramas/genres');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(response.body).toEqual({ items: ['Comedy', 'Drama', 'Romance'] });
  });
});

describe('without a database', () => {
  it('answers 503 and keeps the answer out of the CDN', async () => {
    const response = await request(appWith(undefined)).get('/api/v1/dramas');
    expect(response.status).toBe(503);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toMatchObject({ code: 'dramas.unavailable' });
  });
});

describe('the anime catalog next to the dramas', () => {
  it('answers as before', async () => {
    const anime: AnimeRow = {
      id: 5114,
      title: 'Fullmetal Alchemist: Brotherhood',
      titleEnglish: null,
      titleJapanese: null,
      coverUrl: null,
      format: 'TV',
      startDate: new Date('2009-04-05T00:00:00.000Z'),
      year: 2009,
      episodes: 64,
      durationMinutes: 24,
      genres: ['Action'],
      relations: [],
    };
    const catalog = {
      browse: async () => ({ items: [anime], chain: [], related: [], nextPage: null }),
      genres: async () => ['Action'],
    } as unknown as CatalogService;
    const both = appWith(createDramaService(createDramaCatalogRepository(reader)), catalog);
    const response = await request(both).get('/api/v1/catalog/anime');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(response.body).toEqual({
      items: [{ ...anime, startDate: '2009-04-05' }],
      chain: [],
      related: [],
      nextPage: null,
    });
    const genres = await request(both).get('/api/v1/catalog/genres');
    expect(genres.body).toEqual({ items: ['Action'] });
  });
});
