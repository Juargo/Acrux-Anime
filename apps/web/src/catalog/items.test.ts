import type { Mark } from '@acrux/domain';
import { describe, expect, it } from 'vitest';
import type { CatalogMedia, RelatedMedia } from '../anilist/catalog';
import { toCatalogItems } from './items';

const NOW = '2026-11-03T12:00:00Z';
const cover = (id: number) => `https://img.anili.st/media/${id}.jpg`;

function related(id: number, year: number, extra: Partial<RelatedMedia> = {}): RelatedMedia {
  return {
    id,
    type: 'ANIME',
    format: 'TV',
    idMal: null,
    isAdult: false,
    title: { romaji: `Romaji ${id}`, english: `English ${id}`, native: null },
    coverImage: { large: cover(id) },
    startDate: { year, month: 1, day: 1 },
    ...extra,
  };
}

function hit(
  id: number,
  year: number,
  edges: [string, RelatedMedia][] = [],
  extra: Partial<CatalogMedia> = {},
): CatalogMedia {
  return {
    ...related(id, year),
    relations: { edges: edges.map(([relationType, node]) => ({ relationType, node })) },
    ...extra,
  };
}

describe('toCatalogItems', () => {
  it('splits a franchise the curator marked as separate (RF-60)', () => {
    const hits = [hit(1, 2020), hit(2, 2021, [['PREQUEL', related(1, 2020)]])];
    const separate = {
      animeId: 2,
      franchiseRootId: 1,
      role: 'separate' as const,
      updatedAt: '2026-11-07T12:00:00.000Z',
    };

    expect(toCatalogItems(hits, [], NOW).map((item) => item.coreIds)).toEqual([[1, 2]]);
    expect(toCatalogItems(hits, [], NOW, [separate]).map((item) => item.coreIds)).toEqual([
      [1],
      [2],
    ]);
  });

  it('@CA-RF12-01 shows one item per franchise with cover and title', () => {
    const season1 = related(154587, 2023);
    const items = toCatalogItems(
      [
        hit(154587, 2023, [['SEQUEL', related(182255, 2026)]]),
        hit(182255, 2026, [['PREQUEL', season1]]),
      ],
      [],
      NOW,
    );

    expect(items).toEqual([
      {
        rootId: 154587,
        title: 'English 154587',
        coverUrl: cover(154587),
        dimmed: false,
        coreIds: expect.any(Array),
        entryIds: expect.any(Array),
      },
    ]);
  });

  it('titles the item with the earliest known entry, even when only a sequel matched', () => {
    const items = toCatalogItems([hit(20958, 2017, [['PREQUEL', related(16498, 2013)]])], [], NOW);

    expect(items).toEqual([
      {
        rootId: 16498,
        title: 'English 16498',
        coverUrl: cover(16498),
        dimmed: false,
        coreIds: expect.any(Array),
        entryIds: expect.any(Array),
      },
    ]);
  });

  it('keeps the order of the first hit of each franchise across pages', () => {
    const items = toCatalogItems(
      [hit(1, 2020), hit(2, 2021), hit(3, 2022, [['PREQUEL', related(1, 2020)]])],
      [],
      NOW,
    );

    expect(items.map((item) => item.rootId)).toEqual([1, 2]);
  });

  it('shows a matched side story as its parent franchise', () => {
    const items = toCatalogItems(
      [
        hit(5, 2021, [['PARENT', related(1, 2020)]]),
        hit(1, 2020, [['SIDE_STORY', related(5, 2021)]]),
      ],
      [],
      NOW,
    );

    expect(items.map((item) => item.rootId)).toEqual([1]);
  });

  it('keeps spin-offs and remakes as their own items', () => {
    const items = toCatalogItems(
      [hit(121, 2003, [['ALTERNATIVE', related(5114, 2009)]]), hit(5114, 2009)],
      [],
      NOW,
    );

    expect(items.map((item) => item.rootId)).toEqual([121, 5114]);
  });

  it('never lets adult, music or non-anime neighbours into an item', () => {
    const items = toCatalogItems(
      [
        hit(10, 2020, [
          ['PREQUEL', related(11, 2010, { isAdult: true })],
          ['PREQUEL', related(12, 2011, { format: 'MUSIC' })],
          ['PREQUEL', related(13, 2012, { type: 'MANGA', format: 'MANGA' })],
        ]),
      ],
      [],
      NOW,
    );

    expect(items).toEqual([
      {
        rootId: 10,
        title: 'English 10',
        coverUrl: cover(10),
        dimmed: false,
        coreIds: expect.any(Array),
        entryIds: expect.any(Array),
      },
    ]);
  });

  it('falls back to romaji, then to the native title, and to the hit cover', () => {
    const items = toCatalogItems(
      [
        hit(1, 2020, [], { title: { romaji: 'Sousou no Frieren', english: null, native: null } }),
        hit(2, 2021, [['PREQUEL', related(3, 2019, { coverImage: { large: null } })]]),
        hit(4, 2022, [], { title: { romaji: null, english: null, native: '葬送' } }),
      ],
      [],
      NOW,
    );

    expect(items.map(({ title, coverUrl }) => ({ title, coverUrl }))).toEqual([
      { title: 'Sousou no Frieren', coverUrl: cover(1) },
      { title: 'English 3', coverUrl: cover(2) },
      { title: '葬送', coverUrl: cover(4) },
    ]);
  });

  it('dims a franchise whose whole known core is seen (RF-23)', () => {
    const marks: Mark[] = [
      { animeId: 1, status: 'seen', markedAt: '2025-01-01T00:00:00Z' },
      { animeId: 2, status: 'seen', markedAt: '2025-01-01T00:00:00Z' },
      { animeId: 3, status: 'seen', markedAt: '2025-01-01T00:00:00Z' },
    ];
    const items = toCatalogItems(
      [hit(1, 2020, [['SEQUEL', related(2, 2021)]]), hit(3, 2022), hit(4, 2023)],
      marks,
      NOW,
    );

    expect(items.map(({ rootId, dimmed }) => ({ rootId, dimmed }))).toEqual([
      { rootId: 1, dimmed: true },
      { rootId: 3, dimmed: true },
      { rootId: 4, dimmed: false },
    ]);
  });
});

describe('toCatalogItems ids', () => {
  it('keeps the known core and extras of each item for marking', () => {
    const [item] = toCatalogItems(
      [
        hit(1, 2020, [
          ['SEQUEL', related(2, 2021)],
          ['SIDE_STORY', related(3, 2021)],
        ]),
      ],
      [],
      NOW,
    );

    expect(item).toMatchObject({ coreIds: [1, 2], entryIds: [1, 2, 3] });
  });
});
