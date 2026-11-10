import type { Mark, RelationType } from '@acrux/domain';
import { describe, expect, it } from 'vitest';
import type { CatalogAnime } from '../catalog-source/client';
import { anime } from '../catalog-source/test-support';
import { toCatalogItems } from './items';

const NOW = '2026-11-03T12:00:00Z';
const cover = (id: number) => `https://cdn.example.test/anime/${id}.jpg`;

// A neighbour: an anime the page lacks but a hit points at.
function related(id: number, year: number, extra: Partial<CatalogAnime> = {}): CatalogAnime {
  return anime(id, {
    title: `Title ${id}`,
    titleEnglish: `English ${id}`,
    startDate: `${year}-01-01`,
    year,
    ...extra,
  });
}

// A hit of the page, with its relations to other anime.
function hit(
  id: number,
  year: number,
  links: [RelationType, number][] = [],
  extra: Partial<CatalogAnime> = {},
): CatalogAnime {
  return related(id, year, {
    relations: links.map(([type, target]) => ({ type, id: target })),
    ...extra,
  });
}

const item = (rootId: number, title: string, dimmed = false) => ({
  rootId,
  title,
  coverUrl: cover(rootId),
  dimmed,
  coreIds: expect.any(Array),
  entryIds: expect.any(Array),
});

describe('toCatalogItems', () => {
  it('splits a franchise the curator marked as separate (RF-60)', () => {
    const hits = [hit(1, 2020), hit(2, 2021, [['PREQUEL', 1]])];
    const separate = {
      animeId: 2,
      franchiseRootId: 1,
      role: 'separate' as const,
      updatedAt: '2026-11-07T12:00:00.000Z',
    };

    expect(toCatalogItems(hits, [], [], NOW).map((entry) => entry.coreIds)).toEqual([[1, 2]]);
    expect(toCatalogItems(hits, [], [], NOW, [separate]).map((entry) => entry.coreIds)).toEqual([
      [1],
      [2],
    ]);
  });

  it('@CA-RF12-01 shows one item per franchise with cover and title', () => {
    const items = toCatalogItems(
      [hit(154587, 2023, [['SEQUEL', 182255]]), hit(182255, 2026, [['PREQUEL', 154587]])],
      [],
      [],
      NOW,
    );

    expect(items).toEqual([item(154587, 'English 154587')]);
  });

  it('titles the item with the earliest known entry, even when only a sequel matched', () => {
    const items = toCatalogItems(
      [hit(20958, 2017, [['PREQUEL', 16498]])],
      [related(16498, 2013)],
      [],
      NOW,
    );

    expect(items).toEqual([item(16498, 'English 16498')]);
  });

  it('keeps the order of the first hit of each franchise across pages', () => {
    const items = toCatalogItems(
      [hit(1, 2020), hit(2, 2021), hit(3, 2022, [['PREQUEL', 1]])],
      [],
      [],
      NOW,
    );

    expect(items.map((entry) => entry.rootId)).toEqual([1, 2]);
  });

  it('shows a matched side story as its parent franchise', () => {
    const items = toCatalogItems(
      [hit(5, 2021, [['PARENT', 1]]), hit(1, 2020, [['SIDE_STORY', 5]])],
      [],
      [],
      NOW,
    );

    expect(items.map((entry) => entry.rootId)).toEqual([1]);
  });

  it('keeps spin-offs and remakes as their own items', () => {
    const items = toCatalogItems(
      [hit(121, 2003, [['ALTERNATIVE', 5114]]), hit(5114, 2009)],
      [],
      [],
      NOW,
    );

    expect(items.map((entry) => entry.rootId)).toEqual([121, 5114]);
  });

  it('ignores relations to entries the catalog did not send, such as adult or manga ones', () => {
    // The API leaves adult titles out of `related`, so these ids have no entry here.
    const items = toCatalogItems(
      [
        hit(10, 2020, [
          ['PREQUEL', 11],
          ['PREQUEL', 12],
          ['PREQUEL', 13],
        ]),
      ],
      [],
      [],
      NOW,
    );

    expect(items).toEqual([{ ...item(10, 'English 10'), coreIds: [10], entryIds: [10] }]);
  });

  it('falls back to the title of the source, then to the Japanese one, and to the hit cover', () => {
    const items = toCatalogItems(
      [
        hit(1, 2020, [], { title: 'Sousou no Frieren', titleEnglish: null }),
        hit(2, 2021, [['PREQUEL', 3]]),
        hit(4, 2022, [], { title: '', titleEnglish: null, titleJapanese: '葬送' }),
      ],
      [related(3, 2019, { coverUrl: null })],
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
      [hit(1, 2020, [['SEQUEL', 2]]), hit(3, 2022), hit(4, 2023)],
      [related(2, 2021)],
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
    const [first] = toCatalogItems(
      [
        hit(1, 2020, [
          ['SEQUEL', 2],
          ['SIDE_STORY', 3],
        ]),
      ],
      [related(2, 2021), related(3, 2021)],
      [],
      NOW,
    );

    expect(first).toMatchObject({ coreIds: [1, 2], entryIds: [1, 2, 3] });
  });
});
