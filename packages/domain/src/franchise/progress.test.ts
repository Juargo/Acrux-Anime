import { describe, expect, it } from 'vitest';
import { countCompleteFranchises, countSeenEntries, franchiseProgress } from './progress';
import type { Franchise, Mark } from './types';

const NOW = '2026-11-03T12:00:00Z';

const franchise: Franchise = {
  rootId: 1,
  title: 'Saga',
  core: [
    { id: 1, joinedAt: '2013-04-07' },
    { id: 2, joinedAt: '2017-04-01' },
    { id: 3, joinedAt: '2019-04-29' },
    { id: 4, joinedAt: '2020-12-07' },
    { id: 5, joinedAt: '2023-03-04' },
    { id: 6, joinedAt: null },
  ],
  extras: [7],
  related: [],
};

const seen = (anilistId: number, markedAt = '2024-01-01T00:00:00Z'): Mark => ({
  anilistId,
  status: 'seen',
  markedAt,
});
const watching = (anilistId: number, markedAt = '2024-01-01T00:00:00Z'): Mark => ({
  anilistId,
  status: 'watching',
  markedAt,
});

describe('franchiseProgress', () => {
  it('is unmarked when no core entry is marked, whatever the extras', () => {
    expect(franchiseProgress(franchise, [seen(7)], NOW)).toEqual({
      state: 'unmarked',
      seenCore: 0,
      releasedCore: 5,
      complete: false,
      hasNewEntries: false,
    });
  });

  it('is partial with the progress of the core ("3/5 temporadas")', () => {
    expect(franchiseProgress(franchise, [seen(1), seen(2), seen(3), seen(99)], NOW)).toEqual({
      state: 'partial',
      seenCore: 3,
      releasedCore: 5,
      complete: false,
      hasNewEntries: false,
    });
  });

  it('is seen when the whole released core is seen; extras and unreleased entries do not count', () => {
    const marks = [1, 2, 3, 4, 5].map((id) => seen(id));

    expect(franchiseProgress(franchise, marks, NOW)).toMatchObject({
      state: 'seen',
      seenCore: 5,
      releasedCore: 5,
      complete: true,
    });
  });

  it('puts watching above seen and partial', () => {
    const marks = [seen(1), seen(2), seen(3), seen(4), watching(5)];

    expect(franchiseProgress(franchise, marks, NOW)).toMatchObject({
      state: 'watching',
      seenCore: 4,
      complete: false,
    });
  });

  it('stays complete when a new season comes out after the latest mark (DD-03)', () => {
    const marks = [1, 2, 3, 4].map((id) => seen(id, '2021-06-01T00:00:00Z'));

    expect(franchiseProgress(franchise, marks, NOW)).toEqual({
      state: 'seen',
      seenCore: 4,
      releasedCore: 5,
      complete: true,
      hasNewEntries: true,
    });
  });

  it('is not complete when a season released before the latest mark is missing', () => {
    const marks = [seen(1, '2021-06-01T00:00:00Z'), seen(2), seen(3)];

    expect(franchiseProgress(franchise, marks, NOW)).toMatchObject({
      state: 'partial',
      complete: false,
    });
  });

  it('stays complete when a curator correction adds an entry after the latest mark (RF-60)', () => {
    const corrected: Franchise = {
      ...franchise,
      core: [{ id: 0, joinedAt: '2026-02-01T10:00:00Z' }, ...franchise.core],
    };
    const marks = [1, 2, 3, 4, 5].map((id) => seen(id, '2025-01-01T00:00:00Z'));

    expect(franchiseProgress(corrected, marks, NOW)).toMatchObject({
      state: 'seen',
      complete: true,
      hasNewEntries: true,
    });
  });

  it('counts a seen entry that has not reached its release date yet', () => {
    const marks = [1, 2, 3, 4, 5, 6].map((id) => seen(id));

    expect(franchiseProgress(franchise, marks, NOW)).toMatchObject({
      seenCore: 6,
      releasedCore: 6,
      complete: true,
      hasNewEntries: false,
    });
  });
});

describe('counters (RDI-32)', () => {
  const other: Franchise = {
    rootId: 20,
    title: 'Other',
    core: [
      { id: 20, joinedAt: '2010-01-01' },
      { id: 21, joinedAt: '2011-01-01' },
    ],
    extras: [],
    related: [],
  };

  it('counts franchises with the whole core seen', () => {
    const marks = [...[1, 2, 3, 4, 5].map((id) => seen(id)), seen(20), watching(21)];

    expect(countCompleteFranchises([franchise, other], marks, NOW)).toBe(1);
  });

  it('counts every seen entry of any format once, including entries no longer in the catalog', () => {
    const marks = [seen(1), seen(7), seen(404), seen(1), watching(21)];

    expect(countSeenEntries(marks)).toBe(3);
  });
});
