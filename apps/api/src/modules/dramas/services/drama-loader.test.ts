import { describe, expect, it } from 'vitest';
import { SourceError } from '../../catalog/source-error.js';
import type { DramaSource } from '../adapters/tvmaze.js';
import type { DramaInput, DramaStore } from '../repositories/drama.repository.js';
import { loadDramas } from './drama-loader.js';

const input = (id: number): DramaInput => ({
  id,
  title: `Drama ${id}`,
  searchText: `drama ${id}`,
  summary: null,
  coverUrl: null,
  tvmazeUrl: `https://www.tvmaze.com/shows/${id}/drama`,
  country: 'KR',
  language: 'Korean',
  startDate: null,
  year: null,
  durationMinutes: null,
  genres: [],
  status: null,
  weight: 0,
  imdbId: null,
  thetvdbId: null,
  sourceUpdatedAt: null,
});

function setup(options: {
  // The wanted shows of each page of the index; the page after the last one is the end.
  pages: number[][];
  toDetail?: number[];
  missing?: number[];
  // Errors thrown, in order, by the calls to the source; null lets a call through.
  failures?: (SourceError | null)[];
}) {
  const events: string[] = [];
  const failures = [...(options.failures ?? [])];
  const fail = () => {
    const failure = failures.shift();
    if (failure) throw failure;
  };
  const source: DramaSource = {
    index: async (page) => {
      events.push(`index ${page}`);
      fail();
      const ids = options.pages[page];
      return ids ? { items: ids.map(input), hasNext: true } : { items: [], hasNext: false };
    },
    detail: async (id) => {
      events.push(`detail ${id}`);
      fail();
      return options.missing?.includes(id) ? null : { ...input(id), aliases: [], episodes: 16 };
    },
  };
  const store: DramaStore = {
    saveListed: async (rows) => {
      events.push(`listed ${rows.map((row) => row.id).join(',')}`);
    },
    saveDetailed: async (row) => {
      events.push(`detailed ${row.id}`);
    },
    markChecked: async (id) => {
      events.push(`checked ${id}`);
    },
    nextToDetail: async (limit) => (options.toDetail ?? []).slice(0, limit),
  };
  const sleeps: number[] = [];
  const run = (maxDetails = 10) =>
    loadDramas({
      source,
      store,
      maxDetails,
      delayMs: 600,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
  return { events, sleeps, run };
}

describe('loadDramas', () => {
  it('walks the index to its end, then reads the details the store asks for', async () => {
    const { events, run } = setup({ pages: [[1, 2], [], [3]], toDetail: [3, 1] });

    expect(await run()).toEqual({ listed: 3, detailed: 2, gone: 0, stopped: null });
    expect(events).toEqual([
      'index 0',
      'listed 1,2',
      'index 1',
      'listed ',
      'index 2',
      'listed 3',
      'index 3',
      'listed ',
      'detail 3',
      'detailed 3',
      'detail 1',
      'detailed 1',
    ]);
  });

  it('pauses between two requests, so it stays under the limit of TVmaze', async () => {
    const { sleeps, run } = setup({ pages: [[1], [2]], toDetail: [1, 2] });
    await run();
    // Five requests: three pages of the index and two details.
    expect(sleeps).toEqual([600, 600, 600, 600]);
  });

  it('reads no more details than the run allows', async () => {
    const { events, run } = setup({ pages: [[1, 2, 3]], toDetail: [1, 2, 3] });
    expect(await run(2)).toMatchObject({ detailed: 2 });
    expect(events.filter((event) => event.startsWith('detail '))).toEqual(['detail 1', 'detail 2']);
  });

  it('keeps a show TVmaze no longer has, marked as checked', async () => {
    const { events, run } = setup({ pages: [[1]], toDetail: [1], missing: [1] });
    expect(await run()).toMatchObject({ detailed: 0, gone: 1, stopped: null });
    expect(events).toContain('checked 1');
  });

  it('stops at the first refusal of TVmaze, without asking again', async () => {
    const { events, run } = setup({
      pages: [[1], [2]],
      failures: [null, new SourceError(429, 'TVmaze 429')],
    });

    expect(await run()).toEqual({
      listed: 1,
      detailed: 0,
      gone: 0,
      stopped: 'index page 1: TVmaze 429',
    });
    expect(events).toEqual(['index 0', 'listed 1', 'index 1']);
  });

  it('stops at a refusal while reading details and keeps what it stored', async () => {
    const { events, run } = setup({
      pages: [[1, 2]],
      toDetail: [1, 2],
      failures: [null, null, null, new SourceError(429, 'TVmaze 429')],
    });

    expect(await run()).toMatchObject({ detailed: 1, stopped: 'detail of 2: TVmaze 429' });
    expect(events.at(-1)).toBe('detail 2');
  });

  it('tries a passing failure again', async () => {
    const { run } = setup({
      pages: [[1]],
      failures: [new SourceError(502, 'TVmaze 502')],
    });
    expect(await run()).toMatchObject({ listed: 1, stopped: null });
  });
});
