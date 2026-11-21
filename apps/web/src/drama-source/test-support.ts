import { vi } from 'vitest';
import type { Drama, DramaClient } from './client';

// A drama as the API answers it; tests override only what they look at.
export function drama(id: number, overrides: Partial<Drama> = {}): Drama {
  return {
    id,
    title: `Show ${id}`,
    coverUrl: `https://static.tvmaze.test/${id}.jpg`,
    origin: 'KR',
    year: 2020,
    seasons: 1,
    episodes: 16,
    genres: [],
    ...overrides,
  };
}

// A drama client whose methods are spies; unset ones fail the test that reaches them.
export function fakeDramaClient(methods: Partial<DramaClient> = {}) {
  const unexpected = (name: string) => async () => {
    throw new Error(`Unexpected drama call: ${name}`);
  };
  return {
    browse: vi.fn(methods.browse ?? unexpected('browse')),
    byIds: vi.fn(methods.byIds ?? unexpected('byIds')),
    genres: vi.fn(methods.genres ?? unexpected('genres')),
  } satisfies DramaClient;
}
