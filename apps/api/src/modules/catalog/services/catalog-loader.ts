import { type CatalogSource, RANKING_PAGE_SIZE, SourceError } from '../adapters/myanimelist.js';
import type { CatalogStore } from '../repositories/catalog.repository.js';

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

export interface LoadResult {
  listed: number;
  detailed: number;
  // Anime the source no longer has.
  gone: number;
  // Why the load ended before its work was done; null when it finished.
  stopped: string | null;
}

const MAX_PAGES = 200;
// A request that fails for another reason is tried again this many times in a row.
const MAX_FAILURES = 3;
const FAILURE_PAUSE_MS = 10_000;

export async function loadCatalog({
  source,
  store,
  maxDetails,
  delayMs,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
  maxPages = MAX_PAGES,
}: LoadOptions): Promise<LoadResult> {
  const result: LoadResult = { listed: 0, detailed: 0, gone: 0, stopped: null };

  // Runs one request or one write, retrying a passing failure. A refusal is never retried.
  async function ask<T>(what: string, request: () => Promise<T>): Promise<T | undefined> {
    for (let failures = 0; ; ) {
      try {
        return await request();
      } catch (error) {
        const blocked = error instanceof SourceError && error.blocked;
        failures += 1;
        if (blocked || failures >= MAX_FAILURES) {
          result.stopped = `${what}: ${error instanceof Error ? error.message : String(error)}`;
          return undefined;
        }
        log(`${what} failed (${failures}), trying again`);
        await sleep(FAILURE_PAUSE_MS);
      }
    }
  }

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * RANKING_PAGE_SIZE;
    const answer = await ask(`ranking at ${offset}`, () => source.ranking(offset));
    if (!answer) return result;
    const saved = await ask(`saving the ranking at ${offset}`, async () => {
      await store.saveListed(answer.items);
      return true;
    });
    if (!saved) return result;
    result.listed += answer.items.length;
    log(`listed ${result.listed}`);
    if (!answer.hasNext) break;
    await sleep(delayMs);
  }

  const ids = await ask('choosing the details', () => store.nextToDetail(maxDetails));
  if (!ids) return result;
  for (const [index, id] of ids.entries()) {
    await sleep(delayMs);
    const anime = await ask(`detail of ${id}`, () => source.detail(id));
    if (anime === undefined) return result;
    const saved = await ask(`saving the detail of ${id}`, async () => {
      if (anime === null) await store.markChecked(id);
      else await store.saveDetailed(anime);
      return true;
    });
    if (!saved) return result;
    if (anime === null) result.gone += 1;
    else result.detailed += 1;
    if ((index + 1) % 100 === 0) log(`detailed ${index + 1} of ${ids.length}`);
  }
  return result;
}
