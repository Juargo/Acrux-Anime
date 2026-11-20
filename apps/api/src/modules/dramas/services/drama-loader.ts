import { type LoadResult, loadFromSource } from '../../catalog/services/source-load.js';
import type { DramaSource } from '../adapters/tvmaze.js';
import type { DramaStore } from '../repositories/drama.repository.js';

// The scheduled load of the dramas (ADR-0046, point 3). TVmaze cannot filter by country,
// so every run walks its whole index, keeps the wanted shows and then reads the detail of
// the ones it never read or that TVmaze changed since: that is where aliases, seasons and
// episodes come from. Requests go one at a time with a pause, under the limit of TVmaze,
// and the load stops at the first refusal, like the one of MyAnimeList.
export interface DramaLoadOptions {
  source: DramaSource;
  store: DramaStore;
  // Details read in this run.
  maxDetails: number;
  // Pause between two requests to TVmaze.
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
  // Pages of the index read at most; a guard against an index that never ends.
  maxPages?: number;
}

// The index had 384 pages on 2026-11-19 and grows by a few a month.
const MAX_PAGES = 2000;

export function loadDramas({
  source,
  store,
  maxPages = MAX_PAGES,
  ...options
}: DramaLoadOptions): Promise<LoadResult> {
  return loadFromSource({
    list: (page) => source.index(page),
    pageName: (page) => `index page ${page}`,
    detail: (id) => source.detail(id),
    store,
    maxPages,
    ...options,
  });
}
