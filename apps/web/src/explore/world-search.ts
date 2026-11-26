import { WORLD_PATH, type World } from './last-world';

export const SEARCH_PATH = '/mundos/buscar';

const withSearch = (path: string, search: string) =>
  `${path}?${new URLSearchParams({ q: search })}`;

/** The results of one search in every world. */
export const searchPath = (search: string) => withSearch(SEARCH_PATH, search);

/** The door of a world on a search. */
export const worldSearchPath = (world: World, search: string) =>
  withSearch(WORLD_PATH[world], search);
