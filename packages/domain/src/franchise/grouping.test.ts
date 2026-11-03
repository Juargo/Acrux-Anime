import { describe, expect, it } from 'vitest';
import { groupFranchises } from './grouping';
import type { CatalogEntry, Franchise, FranchiseOverride, Relation, RelationType } from './types';

function entry(
  id: number,
  startDate: string | null,
  relations: [RelationType, number][] = [],
  extra: Partial<CatalogEntry> = {},
): CatalogEntry {
  return {
    id,
    type: 'ANIME',
    format: 'TV',
    title: `Entry ${id}`,
    startDate,
    relations: relations.map(([type, target]): Relation => ({ type, id: target })),
    ...extra,
  };
}

const override = (
  anilistId: number,
  role: FranchiseOverride['role'],
  franchiseRootId: number,
  updatedAt = '2026-01-01T00:00:00Z',
): FranchiseOverride => ({ anilistId, role, franchiseRootId, updatedAt });

const byRoot = (franchises: Franchise[], rootId: number) => {
  const found = franchises.find((franchise) => franchise.rootId === rootId);
  if (!found) throw new Error(`No franchise with root ${rootId}`);
  return found;
};

const coreIds = (franchise: Franchise) => franchise.core.map((member) => member.id);

describe('groupFranchises', () => {
  it('@CA-RF15-01 puts sequels in the core and the spin-off in a separate related franchise', () => {
    const franchises = groupFranchises(
      [
        entry(1, '2013-04-07', [
          ['SEQUEL', 2],
          ['SPIN_OFF', 4],
        ]),
        entry(2, '2017-04-01', [
          ['PREQUEL', 1],
          ['SEQUEL', 3],
        ]),
        entry(3, '2019-01-01', [['PREQUEL', 2]], { format: 'MOVIE' }),
        entry(4, '2018-01-01', [['PARENT', 1]]),
      ],
      [],
    );

    expect(franchises).toHaveLength(2);
    expect(coreIds(byRoot(franchises, 1))).toEqual([1, 2, 3]);
    expect(byRoot(franchises, 1).related).toEqual([4]);
    expect(coreIds(byRoot(franchises, 4))).toEqual([4]);
    expect(byRoot(franchises, 4).related).toEqual([1]);
  });

  it('builds the core from prequels as well as sequels, in either direction', () => {
    const franchises = groupFranchises(
      [entry(10, '2020-01-01', [['PREQUEL', 11]]), entry(11, '2018-01-01')],
      [],
    );

    expect(franchises).toHaveLength(1);
    expect(byRoot(franchises, 11).title).toBe('Entry 11');
    expect(coreIds(byRoot(franchises, 11))).toEqual([11, 10]);
  });

  it('keeps side stories, summaries and compilations as extras one hop from the core', () => {
    const franchises = groupFranchises(
      [
        entry(1, '2010-01-01', [
          ['SIDE_STORY', 5],
          ['SUMMARY', 6],
          ['COMPILATION', 7],
        ]),
        entry(5, '2011-01-01', [
          ['PARENT', 1],
          ['SIDE_STORY', 8],
        ]),
        entry(6, '2011-02-01', [['PARENT', 1]]),
        entry(7, '2011-03-01'),
        entry(8, '2012-01-01'),
      ],
      [],
    );

    expect(coreIds(byRoot(franchises, 1))).toEqual([1]);
    expect(byRoot(franchises, 1).extras).toEqual([5, 6, 7]);
    // Not followed further than one hop: the side story of a side story is its own franchise.
    expect(coreIds(byRoot(franchises, 8))).toEqual([8]);
  });

  it('treats a side story with its own sequels as a separate related franchise', () => {
    const franchises = groupFranchises(
      [
        entry(1, '2010-01-01', [['SIDE_STORY', 5]]),
        entry(5, '2011-01-01', [['SEQUEL', 6]]),
        entry(6, '2012-01-01', [['PREQUEL', 5]]),
      ],
      [],
    );

    expect(byRoot(franchises, 1).extras).toEqual([]);
    expect(byRoot(franchises, 1).related).toEqual([5]);
    expect(coreIds(byRoot(franchises, 5))).toEqual([5, 6]);
  });

  it('links remakes (ALTERNATIVE) as related franchises', () => {
    const franchises = groupFranchises(
      [entry(121, '2003-10-04', [['ALTERNATIVE', 5114]]), entry(5114, '2009-04-05')],
      [],
    );

    expect(franchises.map((franchise) => franchise.rootId)).toEqual([121, 5114]);
    expect(byRoot(franchises, 121).related).toEqual([5114]);
    expect(byRoot(franchises, 5114).related).toEqual([121]);
  });

  it('ignores music entries, non-anime entries and the other relation types', () => {
    const franchises = groupFranchises(
      [
        entry(1, '2010-01-01', [
          ['SEQUEL', 2],
          ['ADAPTATION', 3],
          ['CHARACTER', 4],
          ['OTHER', 5],
          ['SOURCE', 3],
          ['CONTAINS', 6],
        ]),
        entry(2, '2011-01-01', [['PREQUEL', 1]], { format: 'MUSIC' }),
        entry(3, '2008-01-01', [], { type: 'MANGA', format: 'MANGA' }),
        entry(4, '2012-01-01'),
        entry(5, '2013-01-01'),
        entry(6, '2014-01-01'),
      ],
      [],
    );

    expect(franchises.map((franchise) => franchise.rootId)).toEqual([1, 4, 5, 6]);
    expect(coreIds(byRoot(franchises, 1))).toEqual([1]);
    expect(byRoot(franchises, 1).related).toEqual([]);
  });

  it('ignores relations to entries that are not in the given catalog', () => {
    const franchises = groupFranchises([entry(1, '2010-01-01', [['SEQUEL', 99]])], []);

    expect(franchises).toEqual([
      {
        rootId: 1,
        title: 'Entry 1',
        core: [{ id: 1, joinedAt: '2010-01-01' }],
        extras: [],
        related: [],
      },
    ]);
  });

  it('terminates on cycles and roots the franchise at the earliest start date, then lowest id', () => {
    const franchises = groupFranchises(
      [
        entry(3, '2010-01-01', [['SEQUEL', 2]]),
        entry(2, '2010-01-01', [['SEQUEL', 4]]),
        entry(4, null, [['SEQUEL', 3]]),
      ],
      [],
    );

    expect(franchises).toHaveLength(1);
    expect(byRoot(franchises, 2).title).toBe('Entry 2');
    // Unreleased entries go last and have not joined yet.
    expect(byRoot(franchises, 2).core).toEqual([
      { id: 2, joinedAt: '2010-01-01' },
      { id: 3, joinedAt: '2010-01-01' },
      { id: 4, joinedAt: null },
    ]);
  });

  describe('curator overrides apply first', () => {
    it('moves an entry into another franchise core and dates its joining by the correction', () => {
      const franchises = groupFranchises(
        [entry(1, '2010-01-01'), entry(2, '2005-01-01', [['SPIN_OFF', 1]])],
        [override(2, 'core', 1, '2026-02-01T10:00:00Z')],
      );

      expect(franchises).toHaveLength(1);
      expect(byRoot(franchises, 1).core).toEqual([
        { id: 2, joinedAt: '2026-02-01T10:00:00Z' },
        { id: 1, joinedAt: '2010-01-01' },
      ]);
      expect(byRoot(franchises, 1).related).toEqual([]);
    });

    it('splits a sequel chain when the curator marks an entry as separate', () => {
      const franchises = groupFranchises(
        [
          entry(1, '2010-01-01', [['SEQUEL', 2]]),
          entry(2, '2011-01-01', [
            ['PREQUEL', 1],
            ['SEQUEL', 3],
          ]),
          entry(3, '2012-01-01', [['PREQUEL', 2]]),
        ],
        [override(2, 'separate', 1)],
      );

      expect(coreIds(byRoot(franchises, 1))).toEqual([1]);
      expect(coreIds(byRoot(franchises, 2))).toEqual([2, 3]);
      expect(byRoot(franchises, 1).related).toEqual([2]);
      expect(byRoot(franchises, 2).related).toEqual([1]);
    });

    it('turns a core entry into an extra of the given franchise', () => {
      const franchises = groupFranchises(
        [entry(1, '2010-01-01', [['SEQUEL', 2]]), entry(2, '2011-01-01', [['PREQUEL', 1]])],
        [override(2, 'extra', 1)],
      );

      expect(franchises).toHaveLength(1);
      expect(coreIds(byRoot(franchises, 1))).toEqual([1]);
      expect(byRoot(franchises, 1).extras).toEqual([2]);
    });

    it('keeps the curator root even when another core entry started earlier', () => {
      const franchises = groupFranchises(
        [entry(1, '2000-01-01', [['SEQUEL', 2]]), entry(2, '2011-01-01', [['PREQUEL', 1]])],
        [override(1, 'core', 2)],
      );

      expect(franchises.map((franchise) => franchise.rootId)).toEqual([2]);
      expect(byRoot(franchises, 2).title).toBe('Entry 2');
    });

    it('does not merge two franchises the curator rooted differently', () => {
      const franchises = groupFranchises(
        [
          entry(1, '2010-01-01', [['SEQUEL', 2]]),
          entry(2, '2011-01-01', [['PREQUEL', 1]]),
          entry(3, '2012-01-01'),
        ],
        [override(1, 'core', 1), override(2, 'core', 3)],
      );

      expect(coreIds(byRoot(franchises, 1))).toEqual([1]);
      expect(coreIds(byRoot(franchises, 3))).toEqual([2, 3]);
    });

    it('does not let the order of relations decide between two curator roots', () => {
      const catalog = (relations: [RelationType, number][]) => [
        entry(1, '2010-01-01'),
        entry(2, '2011-01-01'),
        entry(3, '2009-01-01', relations),
        entry(4, '2012-01-01'),
        entry(5, '2013-01-01'),
      ];
      const overrides = [override(4, 'core', 1), override(5, 'core', 2)];
      const forward = groupFranchises(
        catalog([
          ['PREQUEL', 1],
          ['PREQUEL', 2],
        ]),
        overrides,
      );
      const backward = groupFranchises(
        catalog([
          ['PREQUEL', 2],
          ['PREQUEL', 1],
        ]),
        overrides,
      );

      expect(backward).toEqual(forward);
      expect(coreIds(byRoot(forward, 1))).toEqual([3, 1, 4]);
    });

    it('ignores overrides for entries outside the catalog or ignored by format', () => {
      const franchises = groupFranchises(
        [entry(1, '2010-01-01'), entry(2, '2011-01-01', [], { format: 'MUSIC' })],
        [override(99, 'core', 1), override(2, 'core', 1)],
      );

      expect(franchises).toHaveLength(1);
      expect(coreIds(byRoot(franchises, 1))).toEqual([1]);
    });
  });
});
