import { describe, expect, it, vi } from 'vitest';
import { createMyAnimeListSource, SourceError, toCatalogAnime } from './myanimelist.js';

// Shapes read from the MyAnimeList API v2 on 2026-11-11 (ADR-0043).
const FULLMETAL = {
  id: 5114,
  title: 'Fullmetal Alchemist: Brotherhood',
  main_picture: {
    medium: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
    large: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg',
  },
  alternative_titles: {
    synonyms: ['Hagane no Renkinjutsushi: Fullmetal Alchemist', 'FMA'],
    en: 'Fullmetal Alchemist: Brotherhood',
    ja: '鋼の錬金術師 FULLMETAL ALCHEMIST',
  },
  start_date: '2009-04-05',
  media_type: 'tv',
  genres: [
    { id: 1, name: 'Action' },
    { id: 2, name: 'Adventure' },
  ],
  num_episodes: 64,
  average_episode_duration: 1460,
  nsfw: 'white',
  num_list_users: 3755133,
  rating: 'r',
  related_anime: [
    { node: { id: 121, title: 'Fullmetal Alchemist' }, relation_type: 'alternative_version' },
    { node: { id: 6421, title: 'Specials' }, relation_type: 'side_story' },
    { node: { id: 7902, title: '4-koma' }, relation_type: 'spin_off' },
  ],
};

describe('toCatalogAnime', () => {
  it('maps a detail to a catalog row, with its relations in the names of the domain', () => {
    expect(toCatalogAnime(FULLMETAL)).toEqual({
      id: 5114,
      title: 'Fullmetal Alchemist: Brotherhood',
      titleEnglish: 'Fullmetal Alchemist: Brotherhood',
      titleJapanese: '鋼の錬金術師 FULLMETAL ALCHEMIST',
      searchText:
        'fullmetal alchemist: brotherhood 鋼の錬金術師 fullmetal alchemist hagane no renkinjutsushi: fullmetal alchemist fma',
      coverUrl: 'https://cdn.myanimelist.net/images/anime/1208/94745l.jpg',
      format: 'TV',
      startDate: new Date('2009-04-05T00:00:00.000Z'),
      year: 2009,
      episodes: 64,
      durationMinutes: 24,
      genres: ['Action', 'Adventure'],
      members: 3755133,
      adult: false,
      relations: [
        { type: 'ALTERNATIVE', id: 121 },
        { type: 'SIDE_STORY', id: 6421 },
        { type: 'SPIN_OFF', id: 7902 },
      ],
    });
  });

  it('leaves the relations out of a list item, which never brings them', () => {
    const { related_anime: _, ...listed } = FULLMETAL;
    expect(toCatalogAnime(listed).relations).toBeUndefined();
  });

  it('maps a bare item: unknown values become null, zero counts are unknown', () => {
    expect(
      toCatalogAnime({ id: 9, title: 'Bare', num_episodes: 0, average_episode_duration: 0 }),
    ).toEqual({
      id: 9,
      title: 'Bare',
      titleEnglish: null,
      titleJapanese: null,
      searchText: 'bare',
      coverUrl: null,
      format: null,
      startDate: null,
      year: null,
      episodes: null,
      durationMinutes: null,
      genres: [],
      members: 0,
      adult: false,
    });
  });

  it.each([
    ['2027-01', '2027-01-01', 2027],
    ['2027', '2027-01-01', 2027],
  ])('stores the partial date %s as its first day', (start, day, year) => {
    const row = toCatalogAnime({ id: 1, title: 'A', start_date: start });
    expect(row.startDate).toEqual(new Date(`${day}T00:00:00.000Z`));
    expect(row.year).toBe(year);
  });

  it.each([
    ['tv', 'TV'],
    ['movie', 'MOVIE'],
    ['ova', 'OVA'],
    ['ona', 'ONA'],
    ['special', 'SPECIAL'],
    ['tv_special', 'SPECIAL'],
    ['music', 'MUSIC'],
    ['pv', 'PV'],
    ['cm', 'CM'],
    ['unknown', null],
  ])('maps the media type %s to %s', (mediaType, format) => {
    expect(toCatalogAnime({ id: 1, title: 'A', media_type: mediaType }).format).toBe(format);
  });

  it.each([
    ['sequel', 'SEQUEL'],
    ['prequel', 'PREQUEL'],
    ['side_story', 'SIDE_STORY'],
    ['parent_story', 'PARENT'],
    ['full_story', 'PARENT'],
    ['summary', 'SUMMARY'],
    ['alternative_version', 'ALTERNATIVE'],
    ['alternative_setting', 'ALTERNATIVE'],
    ['spin_off', 'SPIN_OFF'],
    ['character', 'CHARACTER'],
    ['other', 'OTHER'],
    ['something_new', 'OTHER'],
  ])('maps the relation %s to %s', (relation, type) => {
    const row = toCatalogAnime({
      id: 1,
      title: 'A',
      related_anime: [{ node: { id: 2 }, relation_type: relation }],
    });
    expect(row.relations).toEqual([{ type, id: 2 }]);
  });

  // MyAnimeList sends themes and demographics in the same field as the genres.
  it('keeps the genres and leaves out themes, demographics and erotica', () => {
    const names = ['Comedy', 'School', 'Shounen', 'Isekai', 'Erotica', 'Ecchi', 'Award Winning'];
    const row = toCatalogAnime({ id: 1, title: 'A', genres: names.map((name) => ({ name })) });
    expect(row.genres).toEqual(['Comedy', 'Ecchi', 'Award Winning']);
  });

  it('still flags the adult genre, which the row does not keep', () => {
    const row = toCatalogAnime({ id: 1, title: 'A', genres: [{ name: 'Hentai' }] });
    expect(row).toMatchObject({ adult: true, genres: [] });
  });

  // MyAnimeList marks hentai as nsfw "gray", like ecchi; the rating and the genre tell them apart.
  it.each([
    [{ rating: 'rx', nsfw: 'gray' }, true],
    [{ nsfw: 'black' }, true],
    [{ genres: [{ id: 12, name: 'Hentai' }] }, true],
    [{ rating: 'r+', nsfw: 'gray', genres: [{ id: 9, name: 'Ecchi' }] }, false],
  ])('flags %j as adult: %s', (fields, adult) => {
    expect(toCatalogAnime({ id: 1, title: 'A', ...fields }).adult).toBe(adult);
  });
});

function fakeFetch(answer: (url: URL, init: RequestInit) => Response) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetchFn = vi.fn(async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    return answer(url, init);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('MyAnimeList source', () => {
  it('reads a detail with the client id in the header, relations included', async () => {
    const { fetchFn, calls } = fakeFetch(() => json(FULLMETAL));
    const source = createMyAnimeListSource({ clientId: 'secret-id', fetchFn });

    expect((await source.detail(5114))?.relations).toHaveLength(3);
    expect(calls[0]?.url.href.split('?')[0]).toBe('https://api.myanimelist.net/v2/anime/5114');
    expect(calls[0]?.url.searchParams.get('fields')).toContain('related_anime');
    expect(new Headers(calls[0]?.init.headers).get('X-MAL-CLIENT-ID')).toBe('secret-id');
    expect(calls[0]?.url.href).not.toContain('secret-id');
  });

  it('answers null for an anime MyAnimeList does not have', async () => {
    const { fetchFn } = fakeFetch(() => json({ message: '', error: 'not_found' }, 404));
    expect(await createMyAnimeListSource({ clientId: 'x', fetchFn }).detail(1)).toBeNull();
  });

  it('searches by name, adult titles included so the catalog can flag them', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ data: [{ node: FULLMETAL }], paging: {} }));
    const rows = await createMyAnimeListSource({ clientId: 'x', fetchFn }).search('fullmetal');

    expect(rows.map((row) => row.id)).toEqual([5114]);
    const params = calls[0]?.url.searchParams;
    expect(calls[0]?.url.pathname).toBe('/v2/anime');
    expect(params?.get('q')).toBe('fullmetal');
    expect(params?.get('limit')).toBe('100');
    expect(params?.get('nsfw')).toBe('true');
    expect(params?.get('fields')).not.toContain('related_anime');
  });

  it('does not ask for a name shorter than 3 characters, which MyAnimeList rejects', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ data: [] }));
    expect(await createMyAnimeListSource({ clientId: 'x', fetchFn }).search(' ab ')).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('reads one page of the popularity ranking and tells whether another follows', async () => {
    const { fetchFn, calls } = fakeFetch(() =>
      json({ data: [{ node: FULLMETAL, ranking: { rank: 3 } }], paging: { next: 'https://x' } }),
    );
    const page = await createMyAnimeListSource({ clientId: 'x', fetchFn }).ranking(1000);

    expect(page.items.map((row) => row.id)).toEqual([5114]);
    expect(page.hasNext).toBe(true);
    const params = calls[0]?.url.searchParams;
    expect(calls[0]?.url.pathname).toBe('/v2/anime/ranking');
    expect(params?.get('ranking_type')).toBe('bypopularity');
    expect(params?.get('offset')).toBe('1000');
    expect(params?.get('limit')).toBe('500');
    expect(params?.get('nsfw')).toBe('true');
  });

  it('skips a list item it cannot read instead of failing the page', async () => {
    const { fetchFn } = fakeFetch(() =>
      json({ data: [{ node: { id: 'x' } }, { node: FULLMETAL }], paging: {} }),
    );
    const page = await createMyAnimeListSource({ clientId: 'x', fetchFn }).ranking(0);
    expect(page.items.map((row) => row.id)).toEqual([5114]);
    expect(page.hasNext).toBe(false);
  });

  it.each([403, 429, 500])('fails with the status on a %s', async (status) => {
    const { fetchFn } = fakeFetch(() => json({ error: 'forbidden' }, status));
    const error = await createMyAnimeListSource({ clientId: 'x', fetchFn })
      .detail(1)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).status).toBe(status);
    expect((error as SourceError).blocked).toBe(status === 403 || status === 429);
  });

  it('fails without a status when the request itself fails', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const error = await createMyAnimeListSource({ clientId: 'x', fetchFn })
      .detail(1)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SourceError);
    expect((error as SourceError).status).toBeNull();
  });
});
