import { describe, expect, it } from 'vitest';
import { type CatalogSource, SourceError } from '../adapters/myanimelist.js';
import type { CatalogAnimeInput, CatalogStore } from '../repositories/catalog.repository.js';
import { loadCatalog } from './catalog-loader.js';

const input = (id: number): CatalogAnimeInput => ({
  id,
  title: `Anime ${id}`,
  titleEnglish: null,
  titleJapanese: null,
  searchText: `anime ${id}`,
  coverUrl: null,
  format: 'TV',
  startDate: null,
  year: null,
  episodes: null,
  durationMinutes: null,
  genres: [],
  members: 0,
  adult: false,
});

function setup(options: {
  pages: number[][];
  toDetail?: number[];
  missing?: number[];
  // Errors thrown, in order, by the calls to the source; null lets a call through.
  failures?: (SourceError | null)[];
  // How many writes to the database fail before one goes through.
  storeFailures?: number;
}) {
  const events: string[] = [];
  const failures = [...(options.failures ?? [])];
  const fail = () => {
    const failure = failures.shift();
    if (failure) throw failure;
  };
  let storeFailures = options.storeFailures ?? 0;
  const failStore = () => {
    if (storeFailures > 0) {
      storeFailures -= 1;
      throw new Error('Unable to start a transaction in the given time.');
    }
  };
  const source: CatalogSource = {
    ranking: async (offset) => {
      events.push(`ranking ${offset}`);
      fail();
      const page = offset / 500;
      return {
        items: (options.pages[page] ?? []).map(input),
        hasNext: page < options.pages.length - 1,
      };
    },
    detail: async (id) => {
      events.push(`detail ${id}`);
      fail();
      return options.missing?.includes(id) ? null : { ...input(id), relations: [] };
    },
    search: async () => [],
  };
  const store: CatalogStore = {
    detailState: async () => new Map(),
    saveListed: async (rows) => {
      failStore();
      events.push(`listed ${rows.map((row) => row.id).join(',')}`);
    },
    saveDetailed: async (row) => {
      failStore();
      events.push(`detailed ${row.id}`);
    },
    markChecked: async (id) => {
      events.push(`checked ${id}`);
    },
    nextToDetail: async (limit) => {
      events.push(`next ${limit}`);
      return (options.toDetail ?? []).slice(0, limit);
    },
  };
  const sleep = async (ms: number) => {
    events.push(`sleep ${ms}`);
  };
  return {
    events,
    run: (maxDetails: number) => loadCatalog({ source, store, maxDetails, delayMs: 1000, sleep }),
  };
}

describe('catalog load', () => {
  it('lists every page of the ranking, then reads the details, one request at a time', async () => {
    const { events, run } = setup({ pages: [[1, 2], [3]], toDetail: [3, 1] });
    expect(await run(10)).toEqual({ listed: 3, detailed: 2, gone: 0, stopped: null });
    expect(events).toEqual([
      'ranking 0',
      'listed 1,2',
      'sleep 1000',
      'ranking 500',
      'listed 3',
      'next 10',
      'sleep 1000',
      'detail 3',
      'detailed 3',
      'sleep 1000',
      'detail 1',
      'detailed 1',
    ]);
  });

  it('reads no more details than the run allows', async () => {
    const { events, run } = setup({ pages: [[1, 2, 3]], toDetail: [1, 2, 3] });
    expect((await run(2)).detailed).toBe(2);
    expect(events.filter((event) => event.startsWith('detail '))).toEqual(['detail 1', 'detail 2']);
  });

  it('marks an anime the source no longer has, and goes on', async () => {
    const { events, run } = setup({ pages: [[1, 2]], toDetail: [1, 2], missing: [1] });
    expect(await run(5)).toMatchObject({ detailed: 1, gone: 1, stopped: null });
    expect(events).toContain('checked 1');
    expect(events).toContain('detailed 2');
  });

  it.each([403, 429])('stops at once when the source refuses with a %s', async (status) => {
    const { events, run } = setup({
      pages: [[1, 2]],
      toDetail: [1, 2],
      failures: [null, new SourceError(status, `MyAnimeList ${status}`)],
    });
    expect(await run(5)).toEqual({
      listed: 2,
      detailed: 0,
      gone: 0,
      stopped: `detail of 1: MyAnimeList ${status}`,
    });
    expect(events.filter((event) => event.startsWith('detail '))).toEqual(['detail 1']);
  });

  it('tries a passing failure again after a pause, and stops after three in a row', async () => {
    const down = new SourceError(500, 'MyAnimeList 500');
    const once = setup({ pages: [[1]], toDetail: [1], failures: [down] });
    expect(await once.run(5)).toEqual({ listed: 1, detailed: 1, gone: 0, stopped: null });
    expect(once.events.slice(0, 3)).toEqual(['ranking 0', 'sleep 10000', 'ranking 0']);

    const always = setup({ pages: [[1]], failures: [down, down, down] });
    expect(await always.run(5)).toEqual({
      listed: 0,
      detailed: 0,
      gone: 0,
      stopped: 'ranking at 0: MyAnimeList 500',
    });
    expect(always.events.filter((event) => event === 'ranking 0')).toHaveLength(3);
  });

  it('tries a write to the database again when it fails in passing', async () => {
    const { events, run } = setup({ pages: [[1]], toDetail: [1], storeFailures: 2 });
    const result = await run(1);

    expect(result).toEqual({ listed: 1, detailed: 1, gone: 0, stopped: null });
    expect(events.filter((event) => event === 'listed 1' || event === 'detailed 1')).toEqual([
      'listed 1',
      'detailed 1',
    ]);
  });

  it('stops, with what was saved kept, when the database keeps failing', async () => {
    const { run } = setup({ pages: [[1]], toDetail: [1], storeFailures: 3 });
    const result = await run(1);

    expect(result.listed).toBe(0);
    expect(result.stopped).toContain('saving the ranking at 0');
  });
});
