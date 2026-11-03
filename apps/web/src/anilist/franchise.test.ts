import { describe, expect, it, vi } from 'vitest';
import type { CatalogMedia, RelatedMedia } from './catalog';
import type { AniListClient } from './client';
import { FRANCHISE_MEDIA, fetchFranchise } from './franchise';

function node(id: number, year: number, extra: Partial<RelatedMedia> = {}): RelatedMedia {
  return {
    id,
    idMal: id + 1000,
    type: 'ANIME',
    format: 'TV',
    isAdult: false,
    title: { romaji: `Entry ${id}`, english: null, native: null },
    coverImage: { large: `https://img.anili.st/media/${id}.jpg` },
    startDate: { year, month: 1, day: 1 },
    ...extra,
  };
}

// A saga of four seasons, 1 → 2 → 3 → 4, with a side story 9 and a spin-off 7.
const years: Record<number, number> = { 1: 2013, 2: 2017, 3: 2019, 4: 2020, 7: 2015, 9: 2014 };
const edges: Record<number, [string, number][]> = {
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

function media(id: number): CatalogMedia & { episodes: number; genres: string[] } {
  return {
    ...node(id, years[id] ?? 2000),
    episodes: 12,
    genres: ['Action', 'Supernatural'],
    relations: {
      edges: (edges[id] ?? []).map(([relationType, target]) => ({
        relationType,
        node: node(target, years[target] ?? 2000),
      })),
    },
  };
}

function fakeClient() {
  const request = vi.fn(async (query: string, variables: Record<string, unknown>, schema) => {
    expect(query).toBe(FRANCHISE_MEDIA);
    const ids = variables.ids as number[];
    return schema.parse({ Page: { media: ids.filter((id) => id in years).map(media) } });
  });
  return { client: { request } as unknown as AniListClient, request };
}

describe('fetchFranchise', () => {
  it('follows sequels and prequels until the whole core is known', async () => {
    const { client, request } = fakeClient();

    const franchise = await fetchFranchise(client, [3]);

    expect(franchise.core).toEqual([
      { anilistId: 1, malId: 1001 },
      { anilistId: 2, malId: 1002 },
      { anilistId: 3, malId: 1003 },
      { anilistId: 4, malId: 1004 },
    ]);
    expect(franchise.extras).toEqual([{ anilistId: 9, malId: 1009 }]);
    // Seed 3, then 2 and 4, then 1: one batch per hop, never the side story or the spin-off.
    expect(request.mock.calls.map(([, variables]) => variables.ids)).toEqual([[3], [2, 4], [1]]);
  });

  it('describes the franchise for its detail: entries, genres and related franchises', async () => {
    const { client } = fakeClient();

    const { detail } = await fetchFranchise(client, [2]);

    expect(detail?.franchise.rootId).toBe(1);
    expect(detail?.title).toBe('Entry 1');
    expect(detail?.coverUrl).toBe('https://img.anili.st/media/1.jpg');
    expect(detail?.genres).toEqual(['Action', 'Supernatural']);
    expect(detail?.core.map((entry) => entry.anilistId)).toEqual([1, 2, 3, 4]);
    expect(detail?.core[0]).toEqual({
      anilistId: 1,
      malId: 1001,
      title: 'Entry 1',
      format: 'TV',
      year: 2013,
      episodes: 12,
      coverUrl: 'https://img.anili.st/media/1.jpg',
    });
    // Extras are one hop away: AniList's relation node carries no episode count.
    expect(detail?.extras).toEqual([
      {
        anilistId: 9,
        malId: 1009,
        title: 'Entry 9',
        format: 'TV',
        year: 2014,
        episodes: null,
        coverUrl: 'https://img.anili.st/media/9.jpg',
      },
    ]);
    expect(detail?.related).toEqual([
      { rootId: 7, title: 'Entry 7', coverUrl: 'https://img.anili.st/media/7.jpg' },
    ]);
  });

  it('has no detail when AniList does not know the id', async () => {
    const { client } = fakeClient();

    expect(await fetchFranchise(client, [404])).toEqual({ core: [], extras: [], detail: null });
  });

  it('asks only for anime that is not adult (ADR-0024 rule 8)', () => {
    expect(FRANCHISE_MEDIA).toContain('isAdult: false');
    expect(FRANCHISE_MEDIA).toContain('type: ANIME');
  });

  it('fails instead of saving part of a core when the chain outgrows the request bound', async () => {
    const request = vi.fn(async (_query: string, variables: Record<string, unknown>, schema) => {
      const ids = variables.ids as number[];
      return schema.parse({
        Page: {
          media: ids.map((id) => ({
            ...node(id, 2000 + (id % 20)),
            relations: { edges: [{ relationType: 'SEQUEL', node: node(id + 1, 2001) }] },
          })),
        },
      });
    });

    await expect(fetchFranchise({ request } as unknown as AniListClient, [1])).rejects.toThrow(
      'incomplete',
    );
    expect(request).toHaveBeenCalledTimes(20);
  });

  it('follows a long linear chain such as Monogatari to its end', async () => {
    const last = 18;
    const request = vi.fn(async (_query: string, variables: Record<string, unknown>, schema) => {
      const ids = variables.ids as number[];
      return schema.parse({
        Page: {
          media: ids.map((id) => ({
            ...node(id, 2000 + id),
            relations: {
              edges: [
                ...(id > 1 ? [{ relationType: 'PREQUEL', node: node(id - 1, 1999 + id) }] : []),
                ...(id < last ? [{ relationType: 'SEQUEL', node: node(id + 1, 2001 + id) }] : []),
              ],
            },
          })),
        },
      });
    });

    const franchise = await fetchFranchise({ request } as unknown as AniListClient, [1]);

    expect(franchise.core).toHaveLength(last);
  });
});
