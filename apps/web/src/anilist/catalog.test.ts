import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_PAGE,
  CATALOG_PAGE_SIZE,
  catalogVariables,
  FORMAT_FILTERS,
  fetchCatalogPage,
  fetchGenres,
  GENRES,
} from './catalog';
import type { AniListClient } from './client';

function fakeClient(data: unknown) {
  const request = vi.fn(async (_query: string, _variables: Record<string, unknown>, schema) =>
    schema.parse(data),
  );
  return { client: { request } as unknown as AniListClient, request };
}

const media = {
  id: 154587,
  type: 'ANIME',
  format: 'TV',
  isAdult: false,
  title: { romaji: 'Sousou no Frieren', english: "Frieren: Beyond Journey's End", native: null },
  coverImage: { large: 'https://img.anili.st/media/154587.jpg' },
  startDate: { year: 2023, month: 9, day: 29 },
  relations: {
    edges: [
      {
        relationType: 'SEQUEL',
        node: {
          id: 182255,
          type: 'ANIME',
          format: 'TV',
          isAdult: false,
          title: { romaji: 'Sousou no Frieren 2nd Season', english: null, native: null },
          coverImage: { large: null },
          startDate: { year: 2026, month: null, day: null },
        },
      },
    ],
  },
};

describe('catalog queries', () => {
  it('excludes adult content and music in the catalog query (RF-11, ADR-0024 rule 8)', () => {
    expect(CATALOG_PAGE).toContain('isAdult: false');
    expect(CATALOG_PAGE).toContain('type: ANIME');
    expect(
      catalogVariables({ search: '', year: 2023, genres: [], formats: [] }, 1).formats,
    ).toEqual(['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA']);
  });

  it('searches by name over every year, best match first', () => {
    expect(
      catalogVariables({ search: '  frieren ', year: 2023, genres: [], formats: [] }, 2),
    ).toEqual({
      page: 2,
      perPage: CATALOG_PAGE_SIZE,
      search: 'frieren',
      seasonYear: null,
      genres: null,
      formats: ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA'],
      sort: ['SEARCH_MATCH', 'POPULARITY_DESC'],
    });
  });

  it('@CA-RF13-01 lets AniList filter by year, genre and format, most popular first', () => {
    const tv = FORMAT_FILTERS.find((filter) => filter.label === 'Serie de TV');

    expect(
      catalogVariables(
        { search: '', year: 2023, genres: ['Fantasy'], formats: tv ? [tv.value] : [] },
        1,
      ),
    ).toEqual({
      page: 1,
      perPage: CATALOG_PAGE_SIZE,
      search: null,
      seasonYear: 2023,
      genres: ['Fantasy'],
      formats: ['TV', 'TV_SHORT'],
      sort: ['POPULARITY_DESC'],
    });
  });

  it('validates a page with its one-hop relations and reports whether more pages follow', async () => {
    const { client, request } = fakeClient({
      Page: { pageInfo: { hasNextPage: true }, media: [media] },
    });

    const page = await fetchCatalogPage(
      client,
      { search: 'frieren', year: 2026, genres: [], formats: [] },
      3,
    );

    expect(page).toEqual({ media: [media], nextPage: 4 });
    expect(request).toHaveBeenCalledWith(
      CATALOG_PAGE,
      expect.objectContaining({ page: 3, search: 'frieren' }),
      expect.anything(),
    );
  });

  it('ends the pages when AniList says there are no more', async () => {
    const { client } = fakeClient({ Page: { pageInfo: { hasNextPage: false }, media: [] } });

    expect(
      await fetchCatalogPage(client, { search: '', year: 1917, genres: [], formats: [] }, 1),
    ).toEqual({ media: [], nextPage: null });
  });

  it('rejects a cover that is not https', async () => {
    const { client } = fakeClient({
      Page: {
        pageInfo: { hasNextPage: false },
        media: [{ ...media, coverImage: { large: 'http://img.anili.st/x.jpg' } }],
      },
    });

    await expect(
      fetchCatalogPage(client, { search: '', year: 2023, genres: [], formats: [] }, 1),
    ).rejects.toThrow();
  });

  it('lists AniList genres without the adult one, with Spanish labels', async () => {
    const { client } = fakeClient({ GenreCollection: ['Action', 'Fantasy', 'Hentai', 'Unknown'] });

    expect(await fetchGenres(client)).toEqual([
      { value: 'Action', label: 'Acción' },
      { value: 'Fantasy', label: 'Fantasía' },
      { value: 'Unknown', label: 'Unknown' },
    ]);
    expect(GENRES).toContain('GenreCollection');
  });
});
