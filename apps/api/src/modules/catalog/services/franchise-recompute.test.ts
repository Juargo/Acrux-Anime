import { groupFranchises } from '@acrux/domain';
import { describe, expect, it } from 'vitest';
import type {
  CuratorOverride,
  FranchiseAssignment,
  FranchiseSource,
  FranchiseStore,
} from '../repositories/catalog.repository.js';
import {
  type GroupedFranchise,
  type GroupFranchises,
  type GroupingEntry,
  recomputeFranchises,
} from './franchise-recompute.js';

// The grouping itself is @acrux/domain's and has its own tests; here it is a stub that answers
// the franchises each case needs, and records what it was asked.
function source(id: number, extra: Partial<FranchiseSource> = {}): FranchiseSource {
  return {
    id,
    format: 'TV',
    startDate: null,
    year: null,
    relations: [],
    franchiseRootId: null,
    franchiseYear: null,
    ...extra,
  };
}

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function setup(
  rows: FranchiseSource[],
  franchises: GroupedFranchise[],
  overrides: CuratorOverride[] = [],
) {
  const saved: FranchiseAssignment[][] = [];
  const asked: { entries: GroupingEntry[]; overrides: unknown[] }[] = [];
  const store: FranchiseStore = {
    franchiseSources: async () => rows,
    overrides: async () => overrides,
    saveFranchises: async (changes) => {
      saved.push([...changes]);
    },
  };
  const group: GroupFranchises = (entries, given) => {
    asked.push({ entries, overrides: given });
    return franchises;
  };
  return { store, group, saved, asked };
}

const byId = (changes: FranchiseAssignment[] | undefined) =>
  [...(changes ?? [])].sort((a, b) => a.id - b.id);

describe('recomputeFranchises', () => {
  it('gives every core entry and every extra the root and the lowest core year', async () => {
    const { store, group, saved } = setup(
      [
        source(1, { startDate: date('2016-04-03') }),
        source(2, { startDate: date('2018-10-01') }),
        source(3, { startDate: date('2019-02-02') }),
      ],
      [{ rootId: 1, core: [{ id: 1 }, { id: 2 }], extras: [3] }],
    );
    const result = await recomputeFranchises({ store, group });
    expect(byId(saved[0])).toEqual([
      { id: 1, rootId: 1, year: 2016 },
      { id: 2, rootId: 1, year: 2016 },
      { id: 3, rootId: 1, year: 2016 },
    ]);
    expect(saved).toHaveLength(1);
    expect(result).toEqual({ examined: 3, changed: 3 });
  });

  it('uses the oldest core entry even when a curator pin makes a newer one the root', async () => {
    const { store, group, saved, asked } = setup(
      [
        source(10, { startDate: date('1999-01-01') }),
        source(20, { startDate: date('2012-07-01') }),
      ],
      [{ rootId: 20, core: [{ id: 10 }, { id: 20 }], extras: [] }],
      [{ animeId: 10, franchiseRootId: 20, role: 'core', updatedAt: date('2026-11-01') }],
    );
    await recomputeFranchises({ store, group });
    expect(byId(saved[0])).toEqual([
      { id: 10, rootId: 20, year: 1999 },
      { id: 20, rootId: 20, year: 1999 },
    ]);
    // The curator rows reach the grouping as the domain reads them.
    expect(asked[0]?.overrides).toEqual([
      { animeId: 10, franchiseRootId: 20, role: 'core', updatedAt: '2026-11-01T00:00:00.000Z' },
    ]);
  });

  it('falls back to the year column when an entry has no start date', async () => {
    const { store, group, saved } = setup(
      [source(1, { year: 2004 }), source(2, { startDate: date('2006-04-01'), year: 2006 })],
      [{ rootId: 1, core: [{ id: 1 }, { id: 2 }], extras: [] }],
    );
    await recomputeFranchises({ store, group });
    expect(byId(saved[0])).toEqual([
      { id: 1, rootId: 1, year: 2004 },
      { id: 2, rootId: 1, year: 2004 },
    ]);
  });

  it('stores a root and no year when no core entry has a date or a year', async () => {
    const { store, group, saved } = setup(
      [source(1), source(2, { startDate: date('2020-01-01') })],
      [{ rootId: 1, core: [{ id: 1 }], extras: [2] }],
    );
    await recomputeFranchises({ store, group });
    expect(byId(saved[0])).toEqual([
      { id: 1, rootId: 1, year: null },
      { id: 2, rootId: 1, year: null },
    ]);
  });

  it('clears the franchise of an anime that belongs to none, music videos included', async () => {
    const { store, group, saved, asked } = setup(
      [
        source(1, { startDate: date('2001-01-01') }),
        source(7, { format: 'MUSIC', year: 2013, franchiseRootId: 7, franchiseYear: 2013 }),
      ],
      [{ rootId: 1, core: [{ id: 1 }], extras: [] }],
    );
    await recomputeFranchises({ store, group });
    expect(byId(saved[0])).toEqual([
      { id: 1, rootId: 1, year: 2001 },
      { id: 7, rootId: null, year: null },
    ]);
    // Adult titles never leave the store, so they never reach the grouping.
    expect(asked[0]?.entries.map((entry) => entry.id)).toEqual([1, 7]);
  });

  it('writes nothing when every stored franchise is already right', async () => {
    const { store, group, saved } = setup(
      [
        source(1, { startDate: date('2001-01-01'), franchiseRootId: 1, franchiseYear: 2001 }),
        source(7, { format: 'MUSIC' }),
      ],
      [{ rootId: 1, core: [{ id: 1 }], extras: [] }],
    );
    expect(await recomputeFranchises({ store, group })).toEqual({ examined: 2, changed: 0 });
    expect(saved).toEqual([]);
  });

  it('writes only the rows whose values changed', async () => {
    const { store, group, saved } = setup(
      [
        source(1, { startDate: date('2001-01-01'), franchiseRootId: 1, franchiseYear: 2001 }),
        source(2, { startDate: date('2005-01-01'), franchiseRootId: 2, franchiseYear: 2005 }),
      ],
      [{ rootId: 1, core: [{ id: 1 }, { id: 2 }], extras: [] }],
    );
    expect(await recomputeFranchises({ store, group })).toEqual({ examined: 2, changed: 1 });
    expect(saved).toEqual([[{ id: 2, rootId: 1, year: 2001 }]]);
  });
});

// With the real grouping of @acrux/domain, as the load job runs it.
describe('recomputeFranchises with the grouping of the domain', () => {
  const group = groupFranchises as unknown as GroupFranchises;

  it('keeps the first year of the franchise when the curator pins a newer root', async () => {
    const rows = [
      source(1, { startDate: date('2016-04-03'), relations: [{ type: 'SEQUEL', id: 2 }] }),
      source(2, {
        startDate: date('2019-01-10'),
        relations: [
          { type: 'PREQUEL', id: 1 },
          { type: 'SIDE_STORY', id: 3 },
        ],
      }),
      source(3, { startDate: date('2021-07-01') }),
      source(4, { format: 'MUSIC', startDate: date('2016-01-01') }),
    ];
    const pin: CuratorOverride = {
      animeId: 2,
      franchiseRootId: 2,
      role: 'core',
      updatedAt: date('2026-11-01'),
    };
    const { store, saved } = setup(rows, [], [pin]);

    const result = await recomputeFranchises({ store, group });

    expect(byId(saved[0])).toEqual([
      { id: 1, rootId: 2, year: 2016 },
      { id: 2, rootId: 2, year: 2016 },
      { id: 3, rootId: 2, year: 2016 },
    ]);
    expect(result).toEqual({ examined: 4, changed: 3 });
  });
});
