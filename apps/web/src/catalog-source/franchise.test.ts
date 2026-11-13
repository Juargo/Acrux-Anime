import type { RelationType } from '@acrux/domain';
import { describe, expect, it } from 'vitest';
import type { CatalogAnime } from './client';
import { crawlFranchises, fetchFranchise } from './franchise';
import { anime, fakeCatalogClient, serveFranchises } from './test-support';

// A saga of four seasons, 1 -> 2 -> 3 -> 4, with a side story 9 and a spin-off 7.
const years: Record<number, number> = { 1: 2013, 2: 2017, 3: 2019, 4: 2020, 7: 2015, 9: 2014 };
const links: Record<number, [RelationType, number][]> = {
  1: [
    ['SEQUEL', 2],
    ['SIDE_STORY', 9],
    ['SPIN_OFF', 7],
  ],
  2: [
    ['PREQUEL', 1],
    ['SEQUEL', 3],
  ],
  3: [
    ['PREQUEL', 2],
    ['SEQUEL', 4],
  ],
  4: [['PREQUEL', 3]],
  7: [['PARENT', 1]],
  9: [['PARENT', 1]],
};

const row = (id: number): CatalogAnime =>
  anime(id, {
    startDate: `${years[id] ?? 2000}-01-01`,
    year: years[id] ?? 2000,
    episodes: 12,
    genres: ['Action', 'Supernatural'],
    relations: (links[id] ?? []).map(([type, target]) => ({ type, id: target })),
  });

function fakeApi(
  rows: (id: number) => CatalogAnime | undefined = (id) => (id in years ? row(id) : undefined),
  maxEntries = 1000,
) {
  return fakeCatalogClient({
    franchises: async (seeds) => serveFranchises(rows, seeds, maxEntries),
  });
}

describe('fetchFranchise', () => {
  it('@CA-RF60-01 applies the curator table before automatic grouping (RF-60)', async () => {
    const client = fakeApi();
    // Automatic grouping leaves the side story 9 out of the core; the curator puts it in.
    const sideStoryInCore = {
      animeId: 9,
      franchiseRootId: 1,
      role: 'core' as const,
      updatedAt: '2026-11-07T12:00:00.000Z',
    };

    const franchise = await fetchFranchise(client, [3], [sideStoryInCore]);

    expect(franchise.core.map((entry) => entry.animeId)).toEqual([1, 9, 2, 3, 4]);
    expect(franchise.extras).toEqual([]);
    expect(franchise.detail?.core.map((entry) => entry.animeId)).toContain(9);
  });

  it('gets the whole core from the server in one request, extras and spin-offs apart', async () => {
    const client = fakeApi();

    const franchise = await fetchFranchise(client, [3]);

    expect(franchise.core).toEqual([
      { animeId: 1 },
      { animeId: 2 },
      { animeId: 3 },
      { animeId: 4 },
    ]);
    expect(franchise.extras).toEqual([{ animeId: 9 }]);
    expect(client.franchises.mock.calls).toEqual([[[3]]]);
  });

  it('describes the franchise for its detail: entries, genres and related franchises', async () => {
    const client = fakeApi();

    const { detail } = await fetchFranchise(client, [2]);

    expect(detail?.franchise.rootId).toBe(1);
    expect(detail?.title).toBe('Entry 1');
    expect(detail?.coverUrl).toBe('https://cdn.example.test/anime/1.jpg');
    expect(detail?.genres).toEqual(['Action', 'Supernatural']);
    expect(detail?.core.map((entry) => entry.animeId)).toEqual([1, 2, 3, 4]);
    expect(detail?.core[0]).toEqual({
      animeId: 1,
      title: 'Entry 1',
      format: 'TV',
      year: 2013,
      episodes: 12,
      coverUrl: 'https://cdn.example.test/anime/1.jpg',
    });
    expect(detail?.extras).toEqual([
      {
        animeId: 9,
        title: 'Entry 9',
        format: 'TV',
        year: 2014,
        episodes: 12,
        coverUrl: 'https://cdn.example.test/anime/9.jpg',
      },
    ]);
    expect(detail?.related).toEqual([
      { rootId: 7, title: 'Entry 7', coverUrl: 'https://cdn.example.test/anime/7.jpg' },
    ]);
  });

  it('titles an entry by its English name when it has one, else by its own title', async () => {
    const client = fakeApi((id) =>
      id === 1 ? anime(1, { title: 'Sousou no Frieren', titleEnglish: 'Frieren' }) : undefined,
    );

    expect((await fetchFranchise(client, [1])).detail?.title).toBe('Frieren');
  });

  it('has no detail when the catalog does not hold the id', async () => {
    const client = fakeApi();

    expect(await fetchFranchise(client, [404])).toEqual({ core: [], extras: [], detail: null });
  });

  it('sends the pending ids as seeds of another request until the core is complete', async () => {
    // Each request loads two entries; the saga has four.
    const client = fakeApi(undefined, 2);

    const franchise = await fetchFranchise(client, [1]);

    expect(franchise.core.map((entry) => entry.animeId)).toEqual([1, 2, 3, 4]);
    expect(client.franchises.mock.calls.length).toBeGreaterThan(1);
    expect(client.franchises.mock.calls[0]).toEqual([[1]]);
  });

  it('fails instead of saving part of a core when the chain outgrows the request bound', async () => {
    // An endless chain: every entry has a sequel, and each request brings one entry.
    const client = fakeApi((id) => anime(id, { relations: [{ type: 'SEQUEL', id: id + 1 }] }), 1);

    await expect(fetchFranchise(client, [1])).rejects.toThrow('incomplete');
    expect(client.franchises).toHaveBeenCalledTimes(10);
  });
});

describe('crawlFranchises', () => {
  it('asks for at most 100 seeds per request and returns every id it asked about', async () => {
    const seeds = Array.from({ length: 250 }, (_, index) => index + 1);
    const client = fakeApi((id) => (id !== 7 ? anime(id) : undefined));

    const result = await crawlFranchises(client, seeds);

    expect(client.franchises.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 50]);
    expect(result.items).toHaveLength(249);
    // The id the catalog does not hold counts as asked, so it is never asked twice.
    expect(result.requested.sort((a, b) => a - b)).toEqual(seeds);
    expect(result.pending).toEqual([]);
  });

  it('returns the ids still to crawl instead of failing when it reaches the request bound', async () => {
    const client = fakeApi((id) => anime(id, { relations: [{ type: 'SEQUEL', id: id + 1 }] }), 1);

    const result = await crawlFranchises(client, [1]);

    expect(client.franchises).toHaveBeenCalledTimes(10);
    expect(result.items).toHaveLength(10);
    expect(result.pending).toEqual([11]);
  });

  it('returns the neighbours the server sent along, for titles and covers', async () => {
    const client = fakeApi();

    const result = await crawlFranchises(client, [1]);

    expect(result.related.map((item) => item.id).sort()).toEqual([7, 9]);
  });
});
