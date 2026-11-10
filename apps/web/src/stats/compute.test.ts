import { describe, expect, it } from 'vitest';
import type { StatsMedia } from '../anilist/queries';
import { computeStats } from './compute';

function media(id: number, overrides: Partial<StatsMedia> = {}): StatsMedia {
  return {
    id,
    format: 'TV',
    seasonYear: 2014,
    episodes: 12,
    duration: 24,
    genres: ['Action'],
    ...overrides,
  };
}

describe('computeStats (RF-53)', () => {
  it('adds episodes and minutes of every seen title', () => {
    const stats = computeStats([
      media(1, { episodes: 12, duration: 24 }),
      media(2, { format: 'MOVIE', episodes: 1, duration: 105 }),
    ]);

    expect(stats.titles).toBe(2);
    expect(stats.episodes).toBe(13);
    expect(stats.minutes).toBe(12 * 24 + 105);
    expect(stats.unknownLength).toBe(0);
  });

  it('counts a title without episodes or duration but adds no time for it', () => {
    const stats = computeStats([
      media(1, { episodes: null }),
      media(2, { duration: null }),
      media(3, { episodes: 10, duration: 20 }),
    ]);

    expect(stats.titles).toBe(3);
    expect(stats.episodes).toBe(10);
    expect(stats.minutes).toBe(200);
    expect(stats.unknownLength).toBe(2);
  });

  it('ranks the five most frequent genres as a share of seen titles', () => {
    const stats = computeStats([
      media(1, { genres: ['Action', 'Drama'] }),
      media(2, { genres: ['Action', 'Comedy'] }),
      media(3, { genres: ['Action', 'Drama', 'Romance'] }),
      media(4, { genres: ['Sci-Fi', 'Sports', 'Mystery'] }),
    ]);

    expect(stats.genres).toEqual([
      { genre: 'Action', count: 3, share: 0.75 },
      { genre: 'Drama', count: 2, share: 0.5 },
      { genre: 'Comedy', count: 1, share: 0.25 },
      { genre: 'Mystery', count: 1, share: 0.25 },
      { genre: 'Romance', count: 1, share: 0.25 },
    ]);
    // Every distinct genre counts for the badges, not only the top five (RF-55).
    expect(stats.genreCount).toBe(7);
  });

  it('groups titles by release decade, oldest first, and leaves out unknown years', () => {
    const stats = computeStats([
      media(1, { seasonYear: 2014 }),
      media(2, { seasonYear: 1998 }),
      media(3, { seasonYear: 2010 }),
      media(4, { seasonYear: null }),
    ]);

    expect(stats.decades).toEqual([
      { decade: 1990, count: 1 },
      { decade: 2010, count: 2 },
    ]);
  });

  it('counts titles by format, most frequent first', () => {
    const stats = computeStats([
      media(1, { format: 'MOVIE' }),
      media(2, { format: 'TV' }),
      media(3, { format: 'TV' }),
      media(4, { format: null }),
    ]);

    expect(stats.formats).toEqual([
      { format: 'TV', count: 2 },
      { format: 'MOVIE', count: 1 },
    ]);
  });

  it('returns zeros and empty lists without titles', () => {
    expect(computeStats([])).toEqual({
      titles: 0,
      episodes: 0,
      minutes: 0,
      unknownLength: 0,
      genres: [],
      genreCount: 0,
      decades: [],
      formats: [],
    });
  });
});
