import { describe, expect, it } from 'vitest';
import type { Stats } from '../stats/compute';
import { BADGES, badgeProgress, earnedBadges } from './catalog';

const stats = (overrides: Partial<Stats> = {}): Stats => ({
  titles: 0,
  episodes: 0,
  minutes: 0,
  unknownLength: 0,
  genres: [],
  genreCount: 0,
  decades: [],
  formats: [],
  ...overrides,
});

describe('badge catalog (RF-55)', () => {
  it('has the milestones of titles, hours and genres, in the order the API keeps', () => {
    expect(BADGES.map((badge) => badge.id)).toEqual([
      'titles_10',
      'titles_50',
      'titles_100',
      'titles_250',
      'hours_50',
      'hours_200',
      'hours_500',
      'genres_5',
      'genres_10',
    ]);
  });

  it('earns a badge when the value reaches its goal, and not one short of it', () => {
    const earned = earnedBadges(stats({ titles: 50, minutes: 49 * 60 + 59, genreCount: 5 }));
    expect(earned).toEqual(['titles_10', 'titles_50', 'genres_5']);
  });

  it('shows the progress toward each badge, capped at the goal', () => {
    const progress = badgeProgress(stats({ titles: 7, minutes: 600 * 60, genreCount: 3 }));
    expect(progress.find((badge) => badge.id === 'titles_10')).toMatchObject({
      value: 7,
      goal: 10,
      earned: false,
    });
    expect(progress.find((badge) => badge.id === 'hours_500')).toMatchObject({
      value: 500,
      goal: 500,
      earned: true,
    });
    expect(progress.find((badge) => badge.id === 'genres_10')).toMatchObject({
      value: 3,
      earned: false,
    });
  });

  it('earns nothing without seen titles', () => {
    expect(earnedBadges(stats())).toEqual([]);
  });
});
