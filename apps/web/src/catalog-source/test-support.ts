import { vi } from 'vitest';
import type { CatalogAnime, CatalogClient, FranchiseCrawl } from './client';

// An anime as the catalog API answers it; tests override only what they look at.
export function anime(id: number, overrides: Partial<CatalogAnime> = {}): CatalogAnime {
  return {
    id,
    title: `Entry ${id}`,
    titleEnglish: null,
    titleJapanese: null,
    coverUrl: `https://cdn.example.test/anime/${id}.jpg`,
    format: 'TV',
    startDate: '2000-01-01',
    year: 2000,
    episodes: null,
    durationMinutes: null,
    genres: [],
    relations: [],
    ...overrides,
  };
}

// A catalog client whose methods are spies; unset ones fail the test that reaches them.
export function fakeCatalogClient(methods: Partial<CatalogClient> = {}) {
  const unexpected = (name: string) => async () => {
    throw new Error(`Unexpected catalog call: ${name}`);
  };
  const client = {
    browse: vi.fn(methods.browse ?? unexpected('browse')),
    byIds: vi.fn(methods.byIds ?? unexpected('byIds')),
    franchises: vi.fn(methods.franchises ?? unexpected('franchises')),
    genres: vi.fn(methods.genres ?? unexpected('genres')),
  };
  return client satisfies CatalogClient;
}

const CORE_RELATIONS = new Set(['SEQUEL', 'PREQUEL']);

/**
 * What the franchises route of the API answers: follows sequels and prequels from the seeds,
 * loading at most `maxEntries` entries per request and leaving the rest as `pending`; `related`
 * holds the other neighbours of the entries reached.
 */
export function serveFranchises(
  rows: (id: number) => CatalogAnime | undefined,
  seeds: readonly number[],
  maxEntries = 1000,
): FranchiseCrawl {
  const items = new Map<number, CatalogAnime>();
  const missing: number[] = [];
  let frontier = [...new Set(seeds)];
  let pending: number[] = [];
  while (frontier.length > 0) {
    const room = maxEntries - items.size;
    if (room <= 0) {
      pending = frontier;
      break;
    }
    const batch = frontier.slice(0, room);
    const next = new Set(frontier.slice(room));
    for (const id of batch) {
      const found = rows(id);
      if (!found) {
        missing.push(id);
        continue;
      }
      items.set(id, found);
      for (const relation of found.relations) {
        if (CORE_RELATIONS.has(relation.type) && !items.has(relation.id)) next.add(relation.id);
      }
    }
    frontier = [...next].filter((id) => !items.has(id) && !missing.includes(id));
  }
  const related = new Map<number, CatalogAnime>();
  for (const item of items.values()) {
    for (const relation of item.relations) {
      const found = rows(relation.id);
      if (found && !items.has(relation.id) && !pending.includes(relation.id)) {
        related.set(relation.id, found);
      }
    }
  }
  return { items: [...items.values()], related: [...related.values()], missing, pending };
}
