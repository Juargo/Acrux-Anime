import { z } from 'zod';
import { coverUrl, getJson } from '../catalog-source/client';

// Dramas come from our own API too (ADR-0046); the browser never calls TVmaze. Nothing here
// is stored: TanStack Query keeps the answers in memory only.
const DRAMAS_PATH = '/api/v1/dramas';

export const ORIGINS = ['KR', 'JP', 'CN'] as const;
export type Origin = (typeof ORIGINS)[number];

export const dramaSchema = z.object({
  id: z.number().int().positive(),
  // The international title, as TVmaze names the show.
  title: z.string(),
  coverUrl,
  // The country, or null when the API cannot tell.
  origin: z.enum(ORIGINS).nullable(),
  year: z.number().int().nullable(),
  // Null until the loader reads the detail of the show: never shown as zero.
  seasons: z.number().int().nonnegative().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string()),
});

export type Drama = z.infer<typeof dramaSchema>;

const dramaPageSchema = z.object({
  items: z.array(dramaSchema),
  nextPage: z.number().int().nullable(),
});
const genresSchema = z.object({ items: z.array(z.string()) });

export type DramaPage = z.infer<typeof dramaPageSchema>;

export interface DramaBrowseParams {
  search?: string | undefined;
  // One country, or none for all of them.
  origin?: Origin | undefined;
  genres: readonly string[];
}

export interface DramaClient {
  browse(params: DramaBrowseParams, page: number): Promise<DramaPage>;
  genres(): Promise<string[]>;
}

export function createDramaClient(options: { fetch?: typeof fetch } = {}): DramaClient {
  const fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
  return {
    browse(params, page) {
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.origin) query.set('origin', params.origin);
      if (params.genres.length > 0) query.set('genres', params.genres.join(','));
      query.set('page', String(page));
      return getJson(fetchFn, `${DRAMAS_PATH}?${query}`, dramaPageSchema);
    },
    async genres() {
      return (await getJson(fetchFn, `${DRAMAS_PATH}/genres`, genresSchema)).items;
    },
  };
}
