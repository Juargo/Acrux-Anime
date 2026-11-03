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
    coverImage: { large: null },
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

function media(id: number): CatalogMedia {
  return {
    ...node(id, years[id] ?? 2000),
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

  it('asks only for anime that is not adult (ADR-0024 rule 8)', () => {
    expect(FRANCHISE_MEDIA).toContain('isAdult: false');
    expect(FRANCHISE_MEDIA).toContain('type: ANIME');
  });

  it('stops after a bounded number of requests on very long chains', async () => {
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

    const franchise = await fetchFranchise({ request } as unknown as AniListClient, [1]);

    expect(request).toHaveBeenCalledTimes(10);
    expect(franchise.core.length).toBeGreaterThanOrEqual(10);
  });
});
