import { SourceError } from '../source-error.js';

// The steps every scheduled load shares (ADR-0043, ADR-0046): it first walks the list of
// the source, storing what a list knows, and then reads details, one request each, so only
// a number of them per run. Requests go one at a time with a pause, and the load stops at
// the first refusal of the source.
export interface SourceLoad<Item> {
  // One page of the list of the source; pages count from 0.
  list(page: number): Promise<{ items: Item[]; hasNext: boolean }>;
  // How a page is named in the reason the load stopped at it.
  pageName(page: number): string;
  // null when the source no longer has the item.
  detail(id: number): Promise<Item | null>;
  store: {
    saveListed(items: readonly Item[]): Promise<void>;
    saveDetailed(item: Item): Promise<void>;
    markChecked(id: number): Promise<void>;
    nextToDetail(limit: number): Promise<number[]>;
  };
  // Details read in this run.
  maxDetails: number;
  // Pause between two requests to the source.
  delayMs: number;
  // Pages read at most; a guard against a list that never ends.
  maxPages: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export interface LoadResult {
  listed: number;
  detailed: number;
  // Items the source no longer has.
  gone: number;
  // Why the load ended before its work was done; null when it finished.
  stopped: string | null;
}

// A request that fails for another reason is tried again this many times in a row.
const MAX_FAILURES = 3;
const FAILURE_PAUSE_MS = 10_000;

export async function loadFromSource<Item>({
  list,
  pageName,
  detail,
  store,
  maxDetails,
  delayMs,
  maxPages,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
}: SourceLoad<Item>): Promise<LoadResult> {
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
    const name = pageName(page);
    const answer = await ask(name, () => list(page));
    if (!answer) return result;
    const saved = await ask(`saving the ${name}`, async () => {
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
    const item = await ask(`detail of ${id}`, () => detail(id));
    if (item === undefined) return result;
    const saved = await ask(`saving the detail of ${id}`, async () => {
      if (item === null) await store.markChecked(id);
      else await store.saveDetailed(item);
      return true;
    });
    if (!saved) return result;
    if (item === null) result.gone += 1;
    else result.detailed += 1;
    if ((index + 1) % 100 === 0) log(`detailed ${index + 1} of ${ids.length}`);
  }
  return result;
}
