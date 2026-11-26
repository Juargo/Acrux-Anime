import { WORLD_PATH, type World } from './last-world';

/**
 * The genres that cross the worlds, in the order the map and the crossing show them. Each
 * catalog names its own: MyAnimeList for anime, TVmaze for the dramas. The key is the one of
 * the address.
 */
export const CROSSINGS = [
  { key: 'romance', anime: 'Romance', dramas: 'Romance' },
  { key: 'mystery', anime: 'Mystery', dramas: 'Mystery' },
  { key: 'comedy', anime: 'Comedy', dramas: 'Comedy' },
  { key: 'fantasy', anime: 'Fantasy', dramas: 'Fantasy' },
  { key: 'action', anime: 'Action', dramas: 'Action' },
  { key: 'drama', anime: 'Drama', dramas: 'Drama' },
  { key: 'adventure', anime: 'Adventure', dramas: 'Adventure' },
  { key: 'suspense', anime: 'Suspense', dramas: 'Thriller' },
  { key: 'sci-fi', anime: 'Sci-Fi', dramas: 'Science-Fiction' },
  { key: 'horror', anime: 'Horror', dramas: 'Horror' },
  { key: 'supernatural', anime: 'Supernatural', dramas: 'Supernatural' },
  { key: 'sports', anime: 'Sports', dramas: 'Sports' },
] as const;

export type Crossing = (typeof CROSSINGS)[number];

// The ones the map offers; the crossing itself shows them all.
export const MAP_CROSSINGS = CROSSINGS.slice(0, 4);

export const crossingPath = (crossing: Crossing) => `/mundos/genero/${crossing.key}`;

export const crossingOf = (key: string | undefined) => CROSSINGS.find((it) => it.key === key);

/** The door of a world on the genre of a crossing. */
export const worldGenrePath = (world: World, crossing: Crossing) =>
  `${WORLD_PATH[world]}?genre=${encodeURIComponent(crossing[world])}`;

/** The genre a world opens on, when the address names one a crossing leads to. */
export const doorGenres = (world: World, genre: string | null) =>
  CROSSINGS.filter((it) => it[world] === genre).map((it) => it[world] as string);
