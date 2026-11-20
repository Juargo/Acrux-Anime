import { type CatalogSource, RANKING_PAGE_SIZE } from '../adapters/myanimelist.js';
import type { CatalogStore } from '../repositories/catalog.repository.js';
import { type LoadResult, loadFromSource } from './source-load.js';

// The scheduled load of the catalog (ADR-0043, point 3). It first refreshes the list
// fields of every anime, walking the popularity ranking, and then reads details, which is
// where the relations come from: one request per anime, so only a number of them per run.
// MyAnimeList publishes no request limit and asks not to be burdened (S7): requests go one
// at a time with a pause, and the load stops at the first refusal.
export interface LoadOptions {
  source: CatalogSource;
  store: CatalogStore;
  // Details read in this run.
  maxDetails: number;
  // Pause between two requests to the source.
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
  // Ranking pages read at most; a guard against a ranking that never ends.
  maxPages?: number;
}

export type { LoadResult };

const MAX_PAGES = 200;

export function loadCatalog({
  source,
  store,
  maxPages = MAX_PAGES,
  ...options
}: LoadOptions): Promise<LoadResult> {
  return loadFromSource({
    list: (page) => source.ranking(page * RANKING_PAGE_SIZE),
    pageName: (page) => `ranking at ${page * RANKING_PAGE_SIZE}`,
    detail: (id) => source.detail(id),
    store,
    maxPages,
    ...options,
  });
}
