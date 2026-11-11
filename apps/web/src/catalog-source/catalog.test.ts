import { describe, expect, it } from 'vitest';
import {
  browseParams,
  FORMAT_FILTERS,
  fetchCatalogPage,
  fetchGenres,
  formatLabel,
  genreLabel,
} from './catalog';
import { anime, fakeCatalogClient } from './test-support';

describe('browseParams', () => {
  it('searches by name over every year (ADR-0017): the year is not sent', () => {
    expect(browseParams({ search: '  frieren ', year: 2023, genres: [], formats: [] })).toEqual({
      search: 'frieren',
      genres: [],
      formats: [],
    });
  });

  it('@CA-RF13-01 filters by year, genre and format when there is no search', () => {
    const tv = FORMAT_FILTERS.find((filter) => filter.label === 'Serie de TV');

    expect(
      browseParams({ search: '', year: 2023, genres: ['Fantasy'], formats: tv ? [tv.value] : [] }),
    ).toEqual({ year: 2023, genres: ['Fantasy'], formats: ['TV'] });
  });

  it('sends no formats when none is picked, so the API takes all of them (RF-11)', () => {
    expect(browseParams({ search: '', year: 2023, genres: [], formats: [] }).formats).toEqual([]);
  });

  it('offers the five formats of the filter sheet and no music', () => {
    expect(FORMAT_FILTERS.map((filter) => filter.value)).toEqual([
      'TV',
      'MOVIE',
      'OVA',
      'ONA',
      'SPECIAL',
    ]);
  });
});

describe('fetchCatalogPage', () => {
  it('asks the client for the page and returns it with its neighbours', async () => {
    const page = { items: [anime(1)], related: [anime(2)], nextPage: 4 };
    const client = fakeCatalogClient({ browse: async () => page });

    const result = await fetchCatalogPage(
      client,
      { search: 'frieren', year: 2026, genres: [], formats: [] },
      3,
    );

    expect(result).toEqual(page);
    expect(client.browse).toHaveBeenCalledWith({ search: 'frieren', genres: [], formats: [] }, 3);
  });

  it('ends the pages when the API says there are no more', async () => {
    const client = fakeCatalogClient({
      browse: async () => ({ items: [], related: [], nextPage: null }),
    });

    expect(
      (await fetchCatalogPage(client, { search: '', year: 1917, genres: [], formats: [] }, 1))
        .nextPage,
    ).toBeNull();
  });
});

describe('fetchGenres', () => {
  it('lists the genres without the adult one, with Spanish labels', async () => {
    const client = fakeCatalogClient({
      genres: async () => ['Action', 'Fantasy', 'Hentai', 'Unknown'],
    });

    expect(await fetchGenres(client)).toEqual([
      { value: 'Action', label: 'Acción' },
      { value: 'Fantasy', label: 'Fantasía' },
      { value: 'Unknown', label: 'Unknown' },
    ]);
  });
});

describe('labels', () => {
  it('fall back to the raw value when the name is not in the translations', () => {
    expect(genreLabel('Gourmet')).toBe('Gourmet');
    expect(formatLabel('CM')).toBe('CM');
  });
});
