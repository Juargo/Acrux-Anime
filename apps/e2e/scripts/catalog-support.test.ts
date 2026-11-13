import { describe, expect, it } from 'vitest';
import { answer, FRIEREN, SPY_FAMILY } from '../support/catalog.ts';

const ask = (path: string) => answer(new URL(path, 'http://localhost')) as Record<string, unknown>;
const ids = (list: unknown) => (list as { id: number }[]).map((anime) => anime.id);

describe('catalog support for the E2E journeys', () => {
  it('answers a search by name with both seasons of Frieren, and no neighbours it already has', () => {
    const page = ask(`/api/v1/catalog/anime?search=${FRIEREN.search}&page=1`);

    expect(ids(page.items)).toEqual([154587, 182255]);
    expect(page.related).toEqual([]);
    expect(page.nextPage).toBeNull();
  });

  it('answers a year with the anime that started in it, and the neighbours the page lacks', () => {
    const page = ask('/api/v1/catalog/anime?year=2022&page=1');

    expect(ids(page.items)).toEqual([140960, 142838]);
    expect(page.related).toEqual([]);
    expect(ids(ask('/api/v1/catalog/anime?year=2023&page=1').related)).toEqual([182255]);
  });

  it('follows sequels and prequels from a seed, with nothing missing or pending', () => {
    const crawl = ask(`/api/v1/catalog/franchises?seeds=${SPY_FAMILY.part2Id}`);

    expect(ids(crawl.items).sort()).toEqual([SPY_FAMILY.rootId, SPY_FAMILY.part2Id]);
    expect(crawl.missing).toEqual([]);
    expect(crawl.pending).toEqual([]);
  });

  it('reports an id it does not hold as missing', () => {
    expect(ask('/api/v1/catalog/franchises?seeds=404')).toMatchObject({
      items: [],
      missing: [404],
    });
  });

  it('answers by ids and the genre list, with the fields the web app validates', () => {
    const [first] = (ask('/api/v1/catalog/anime/by-ids?ids=154587').items ?? []) as Record<
      string,
      unknown
    >[];

    expect(first).toEqual({
      id: 154587,
      title: 'Sousou no Frieren',
      titleEnglish: "Frieren: Beyond Journey's End",
      titleJapanese: '葬送のフリーレン',
      coverUrl: 'https://covers.e2e.test/anime/e2e-154587.png',
      format: 'TV',
      startDate: '2023-09-29',
      year: 2023,
      episodes: 28,
      durationMinutes: 24,
      genres: ['Adventure', 'Drama', 'Fantasy'],
      relations: [{ type: 'SEQUEL', id: 182255 }],
    });
    expect(ask('/api/v1/catalog/genres').items).toContain('Fantasy');
  });
});
