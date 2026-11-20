import { describe, expect, it, vi } from 'vitest';
import { SourceError } from '../../catalog/source-error.js';
import { createTvmazeSource, isWanted, toDrama } from './tvmaze.js';

// Shapes read from the TVmaze API on 2026-11-20 (ADR-0046).
const UNTAMED = {
  id: 42806,
  url: 'https://www.tvmaze.com/shows/42806/the-untamed',
  name: 'The Untamed',
  type: 'Scripted',
  language: 'Chinese',
  genres: ['Drama', 'Romance', 'Mystery'],
  status: 'Ended',
  runtime: null,
  averageRuntime: 46,
  premiered: '2019-06-27',
  ended: '2019-08-20',
  weight: 66,
  network: null,
  webChannel: {
    id: 104,
    name: 'Tencent QQ',
    country: { name: 'China', code: 'CN', timezone: 'Asia/Shanghai' },
  },
  externals: { tvrage: null, thetvdb: 355148, imdb: 'tt10554898' },
  image: {
    medium: 'https://static.tvmaze.com/uploads/images/medium_portrait/236/592104.jpg',
    original: 'https://static.tvmaze.com/uploads/images/original_untouched/236/592104.jpg',
  },
  summary: '<p>The pugilist world is ruled by the <b>Wen clan</b> &amp; its allies.</p>',
  updated: 1763973780,
};

const UNTAMED_ROW = {
  id: 42806,
  title: 'The Untamed',
  searchText: 'the untamed',
  summary: 'The pugilist world is ruled by the Wen clan & its allies.',
  coverUrl: 'https://static.tvmaze.com/uploads/images/original_untouched/236/592104.jpg',
  tvmazeUrl: 'https://www.tvmaze.com/shows/42806/the-untamed',
  country: 'CN',
  language: 'Chinese',
  startDate: new Date('2019-06-27T00:00:00.000Z'),
  year: 2019,
  durationMinutes: 46,
  genres: ['Drama', 'Romance', 'Mystery'],
  status: 'Ended',
  weight: 66,
  imdbId: 'tt10554898',
  thetvdbId: 355148,
  sourceUpdatedAt: new Date(1763973780 * 1000),
};

const show = (overrides: Record<string, unknown>) => ({
  ...UNTAMED,
  network: null,
  webChannel: null,
  ...overrides,
});
const country = (code: string) => ({ id: 1, name: 'x', country: { code } });

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('toDrama', () => {
  it('maps a show of the index to a drama row, without the fields only a detail has', () => {
    expect(toDrama(UNTAMED)).toEqual(UNTAMED_ROW);
  });

  it('takes the country of the network before the one of the platform', () => {
    const row = toDrama(show({ network: country('KR'), webChannel: country('US') }));
    expect(row.country).toBe('KR');
  });

  it('leaves empty what TVmaze does not know', () => {
    const row = toDrama({ id: 7, url: 'https://www.tvmaze.com/shows/7/x', name: 'X' });
    expect(row).toMatchObject({
      summary: null,
      coverUrl: null,
      country: null,
      language: null,
      startDate: null,
      year: null,
      durationMinutes: null,
      genres: [],
      weight: 0,
      imdbId: null,
      thetvdbId: null,
      sourceUpdatedAt: null,
    });
  });

  it.each(['2019-02-31', '0000-01-01', '2019-06', 'soon'])(
    'stores no start date for %s',
    (premiered) => {
      expect(toDrama({ ...UNTAMED, premiered })).toMatchObject({ startDate: null, year: null });
    },
  );
});

describe('isWanted', () => {
  it.each(['KR', 'JP', 'CN'])('takes a scripted show of %s by its network', (code) => {
    expect(isWanted(show({ network: country(code) }))).toBe(true);
  });

  it('takes a scripted show by the country of its platform', () => {
    expect(isWanted(UNTAMED)).toBe(true);
  });

  it.each(['Korean', 'Japanese', 'Chinese'])(
    'takes a scripted show without country when it is in %s',
    (language) => {
      expect(isWanted(show({ language }))).toBe(true);
    },
  );

  it('leaves out a show that is not scripted', () => {
    expect(isWanted(show({ type: 'Reality', network: country('KR') }))).toBe(false);
  });

  it('leaves out other countries, whatever the language', () => {
    expect(isWanted(show({ network: country('TH'), language: 'Thai' }))).toBe(false);
    expect(isWanted(show({ network: country('TW'), language: 'Chinese' }))).toBe(false);
    expect(isWanted(show({ network: country('US'), language: 'Korean' }))).toBe(false);
  });

  it('leaves out a show without country in another language', () => {
    expect(isWanted(show({ language: 'English' }))).toBe(false);
    expect(isWanted(show({ language: null }))).toBe(false);
  });
});

describe('createTvmazeSource', () => {
  it('reads one page of the index, without a key, and keeps only the wanted shows', async () => {
    const fetchFn = vi.fn(async () =>
      respond([
        UNTAMED,
        show({ id: 2, type: 'Reality', network: country('KR') }),
        show({ id: 3, network: country('US'), language: 'English' }),
        { broken: true },
      ]),
    );
    const page = await createTvmazeSource({ fetchFn }).index(3);

    expect(page).toEqual({ items: [UNTAMED_ROW], hasNext: true });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe('https://api.tvmaze.com/shows?page=3');
    expect(init.headers).toBeUndefined();
  });

  it('ends the index at the page TVmaze does not have', async () => {
    const source = createTvmazeSource({ fetchFn: async () => respond({}, 404) });
    expect(await source.index(999)).toEqual({ items: [], hasNext: false });
  });

  it('reads a detail with its aliases, seasons and episodes', async () => {
    const fetchFn = vi.fn(async () =>
      respond({
        ...UNTAMED,
        _embedded: {
          akas: [
            { name: '陈情令', country: { code: 'CN' } },
            { name: 'Chén Qíng Lìng', country: { code: 'CN' } },
            { name: ' The Untamed ', country: null },
            { name: '陈情令', country: null },
          ],
          seasons: [{ id: 97852, number: 1 }],
          episodes: Array.from({ length: 50 }, (_, index) => ({ id: index + 1 })),
        },
      }),
    );
    const drama = await createTvmazeSource({ fetchFn }).detail(42806);

    expect(drama).toEqual({
      ...UNTAMED_ROW,
      aliases: ['陈情令', 'Chén Qíng Lìng'],
      searchText: 'the untamed 陈情令 chen qing ling',
      seasons: 1,
      episodes: 50,
    });
    expect(String((fetchFn.mock.calls[0] as unknown as [URL])[0])).toBe(
      'https://api.tvmaze.com/shows/42806?embed%5B%5D=akas&embed%5B%5D=seasons&embed%5B%5D=episodes',
    );
  });

  it('states no seasons or episodes when the detail brings none', async () => {
    const source = createTvmazeSource({
      fetchFn: async () =>
        respond({ ...UNTAMED, _embedded: { akas: [], seasons: [], episodes: [] } }),
    });
    expect(await source.detail(42806)).toMatchObject({
      aliases: [],
      seasons: null,
      episodes: null,
    });
  });

  it('answers null for a show TVmaze no longer has', async () => {
    const source = createTvmazeSource({ fetchFn: async () => respond({}, 404) });
    expect(await source.detail(1)).toBeNull();
  });

  it.each([429, 403])('reports a %i as a refusal', async (status) => {
    const source = createTvmazeSource({ fetchFn: async () => respond({}, status) });
    const error = await source.index(0).catch((caught) => caught);
    expect(error).toBeInstanceOf(SourceError);
    expect(error.blocked).toBe(true);
  });

  it('reports another failure as one that may pass', async () => {
    const failing = createTvmazeSource({ fetchFn: async () => respond({}, 502) });
    const unreadable = createTvmazeSource({ fetchFn: async () => respond({ not: 'a list' }) });
    const offline = createTvmazeSource({
      fetchFn: async () => {
        throw new Error('network down');
      },
    });
    for (const source of [failing, unreadable, offline]) {
      const error = await source.index(0).catch((caught) => caught);
      expect(error).toBeInstanceOf(SourceError);
      expect(error.blocked).toBe(false);
    }
  });
});
