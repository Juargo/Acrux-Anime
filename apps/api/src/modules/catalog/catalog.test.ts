import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createContainer, createModules } from '../../container.js';
import type { AnimeRow } from './repositories/catalog.repository.js';
import type { BrowseFilters, CatalogService } from './services/catalog.service.js';

// The catalog module (ADR-0043): public, read-only and cacheable; anime ids are
// MyAnimeList ids.
const FULLMETAL: AnimeRow = {
  id: 5114,
  title: 'Fullmetal Alchemist: Brotherhood',
  titleEnglish: 'Fullmetal Alchemist: Brotherhood',
  titleJapanese: '鋼の錬金術師 FULLMETAL ALCHEMIST',
  coverUrl: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg',
  format: 'TV',
  startDate: new Date('2009-04-05T00:00:00.000Z'),
  year: 2009,
  episodes: 64,
  durationMinutes: 24,
  genres: ['Action', 'Adventure'],
  relations: [{ type: 'SIDE_STORY', id: 6421 }],
};

const FULLMETAL_JSON = { ...FULLMETAL, startDate: '2009-04-05' };

function fakeService() {
  const calls: unknown[] = [];
  const service: CatalogService = {
    browse: async (filters: BrowseFilters, page: number) => {
      calls.push({ filters, page });
      return { items: [FULLMETAL], related: [], nextPage: 2 };
    },
    byIds: async (ids) => {
      calls.push({ ids });
      return [FULLMETAL];
    },
    franchises: async (seeds) => {
      calls.push({ seeds });
      return { items: [FULLMETAL], related: [], missing: [9], pending: [] };
    },
    genres: async () => ['Action', 'Drama'],
  };
  return { service, calls };
}

function appWith(service: CatalogService | undefined) {
  const base = createContainer({});
  return createApp({
    ...base,
    modules: createModules(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      service,
    ),
  });
}

const CACHE = 'public, max-age=0, s-maxage=300';

describe('GET /api/v1/catalog/anime', () => {
  it('gives a page to anyone, without a session, and lets the CDN keep it', async () => {
    const { service, calls } = fakeService();
    const response = await request(appWith(service)).get('/api/v1/catalog/anime');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(response.body).toEqual({ items: [FULLMETAL_JSON], related: [], nextPage: 2 });
    // RF-11: without a format filter, every format except music.
    expect(calls).toEqual([
      { filters: { genres: [], formats: ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'] }, page: 1 },
    ]);
  });

  it('passes the name, year, genres, formats and page it was asked for', async () => {
    const { service, calls } = fakeService();
    const response = await request(appWith(service)).get('/api/v1/catalog/anime').query({
      search: '  alchemist ',
      year: '2009',
      genres: 'Action,Slice of Life',
      formats: 'TV,MOVIE',
      page: '3',
    });
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      {
        filters: {
          search: 'alchemist',
          year: 2009,
          genres: ['Action', 'Slice of Life'],
          formats: ['TV', 'MOVIE'],
        },
        page: 3,
      },
    ]);
  });

  it.each([
    ['a year that is not a number', { year: '20x9' }],
    ['a year out of range', { year: '1800' }],
    ['an unknown format', { formats: 'TV,MUSIC' }],
    ['page zero', { page: '0' }],
    ['a page past the limit', { page: '1001' }],
    ['a name longer than 100 characters', { search: 'a'.repeat(101) }],
    ['more than 10 genres', { genres: Array.from({ length: 11 }, (_, i) => `G${i}`).join(',') }],
    ['an empty genre', { genres: 'Action,,Drama' }],
  ])('answers 400 to %s', async (_name, query) => {
    const { service, calls } = fakeService();
    const response = await request(appWith(service)).get('/api/v1/catalog/anime').query(query);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'catalog.invalid_query' });
    expect(calls).toEqual([]);
  });

  it('answers 400 to a parameter given twice', async () => {
    const { service } = fakeService();
    const response = await request(appWith(service)).get(
      '/api/v1/catalog/anime?year=2009&year=2010',
    );
    expect(response.status).toBe(400);
  });

  it('answers 503 when the database is not configured', async () => {
    const response = await request(appWith(undefined)).get('/api/v1/catalog/anime');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'catalog.unavailable' });
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});

describe('GET /api/v1/catalog/anime/by-ids', () => {
  it('gives the anime of the ids, repeats removed', async () => {
    const { service, calls } = fakeService();
    const response = await request(appWith(service)).get(
      '/api/v1/catalog/anime/by-ids?ids=5114,121,5114',
    );
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(response.body).toEqual({ items: [FULLMETAL_JSON] });
    expect(calls).toEqual([{ ids: [5114, 121] }]);
  });

  it.each([
    ['no ids', ''],
    ['an id that is not a positive integer', '?ids=5114,abc'],
    ['an id past int4', '?ids=2147483648'],
    ['more than 100 ids', `?ids=${Array.from({ length: 101 }, (_, i) => i + 1).join(',')}`],
  ])('answers 400 to %s', async (_name, query) => {
    const { service, calls } = fakeService();
    const response = await request(appWith(service)).get(`/api/v1/catalog/anime/by-ids${query}`);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'catalog.invalid_query' });
    expect(calls).toEqual([]);
  });
});

describe('GET /api/v1/catalog/franchises', () => {
  it('gives the crawled entries, their neighbours and the ids it could not resolve', async () => {
    const { service, calls } = fakeService();
    const response = await request(appWith(service)).get('/api/v1/catalog/franchises?seeds=5114,9');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(response.body).toEqual({
      items: [FULLMETAL_JSON],
      related: [],
      missing: [9],
      pending: [],
    });
    expect(calls).toEqual([{ seeds: [5114, 9] }]);
  });

  it('answers 400 without seeds', async () => {
    const { service } = fakeService();
    const response = await request(appWith(service)).get('/api/v1/catalog/franchises');
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'catalog.invalid_query' });
  });
});

describe('GET /api/v1/catalog/genres', () => {
  it('gives the genres of the catalog', async () => {
    const { service } = fakeService();
    const response = await request(appWith(service)).get('/api/v1/catalog/genres');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe(CACHE);
    expect(response.body).toEqual({ items: ['Action', 'Drama'] });
  });
});
