import { z } from 'zod';

// The browser reads the catalog from our own API (ADR-0043); it never calls the data source.
// Nothing here is stored: TanStack Query keeps the answers in memory only.
const ANIME_PATH = '/api/v1/catalog/anime';

export type CatalogErrorKind = 'rate-limited' | 'unavailable' | 'invalid-response' | 'query';

export class CatalogError extends Error {
  constructor(
    readonly kind: CatalogErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

// A cover that is not https is dropped, not fatal: one odd URL must not hide a whole page.
const coverUrl = z
  .string()
  .nullable()
  .transform((url) => (url?.startsWith('https://') ? url : null));

const animeId = z.number().int().positive();

export const catalogAnimeSchema = z.object({
  id: animeId,
  title: z.string(),
  titleEnglish: z.string().nullable(),
  titleJapanese: z.string().nullable(),
  coverUrl,
  format: z.string().nullable(),
  // 'YYYY-MM-DD'; null while the date is unknown or partial.
  startDate: z.string().nullable(),
  year: z.number().int().nullable(),
  episodes: z.number().int().nonnegative().nullable(),
  // Minutes per episode.
  durationMinutes: z.number().int().nonnegative().nullable(),
  genres: z.array(z.string()),
  relations: z.array(z.object({ type: z.string(), id: animeId })),
});

export type CatalogAnime = z.infer<typeof catalogAnimeSchema>;

const browsePageSchema = z.object({
  items: z.array(catalogAnimeSchema),
  related: z.array(catalogAnimeSchema),
  nextPage: z.number().int().nullable(),
});
const byIdsSchema = z.object({ items: z.array(catalogAnimeSchema) });
const franchisesSchema = z.object({
  items: z.array(catalogAnimeSchema),
  related: z.array(catalogAnimeSchema),
  missing: z.array(animeId),
  pending: z.array(animeId),
});
const genresSchema = z.object({ items: z.array(z.string()) });

export interface BrowseParams {
  search?: string | undefined;
  year?: number | undefined;
  genres: readonly string[];
  // API format names (TV, MOVIE, OVA, ONA, SPECIAL); none means all of them.
  formats: readonly string[];
}

// One page of the catalog: the hits, the neighbours one hop away that the page lacks, and the
// next page number (null on the last one).
export type BrowsePage = z.infer<typeof browsePageSchema>;

// What the server found by following sequels and prequels from the seeds.
export type FranchiseCrawl = z.infer<typeof franchisesSchema>;

export interface CatalogClient {
  browse(params: BrowseParams, page: number): Promise<BrowsePage>;
  // One request: at most 100 ids (see queries.ts for the batching).
  byIds(ids: readonly number[]): Promise<CatalogAnime[]>;
  // One request: at most 100 seeds; `pending` ids are for the next request (see franchise.ts).
  franchises(seeds: readonly number[]): Promise<FranchiseCrawl>;
  genres(): Promise<string[]>;
}

export interface CatalogClientOptions {
  fetch?: typeof fetch;
}

export function createCatalogClient(options: CatalogClientOptions = {}): CatalogClient {
  const fetchFn = options.fetch ?? ((input, init) => fetch(input, init));

  async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await fetchFn(path);
    } catch {
      throw new CatalogError('unavailable', 'The catalog could not be reached');
    }
    if (response.status === 429) {
      throw new CatalogError('rate-limited', 'The catalog is limiting requests');
    }
    if (response.status >= 500) {
      throw new CatalogError('unavailable', `The catalog answered ${response.status}`);
    }
    if (!response.ok) {
      throw new CatalogError('query', `The catalog rejected the query (${response.status})`);
    }
    const body: unknown = await response.json().catch(() => undefined);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new CatalogError('invalid-response', 'The catalog sent an unexpected answer');
    }
    return parsed.data;
  }

  return {
    browse(params, page) {
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.year !== undefined) query.set('year', String(params.year));
      if (params.genres.length > 0) query.set('genres', params.genres.join(','));
      if (params.formats.length > 0) query.set('formats', params.formats.join(','));
      query.set('page', String(page));
      return get(`${ANIME_PATH}?${query}`, browsePageSchema);
    },
    async byIds(ids) {
      return (await get(`${ANIME_PATH}/by-ids?ids=${ids.join(',')}`, byIdsSchema)).items;
    },
    franchises(seeds) {
      return get(`/api/v1/catalog/franchises?seeds=${seeds.join(',')}`, franchisesSchema);
    },
    async genres() {
      return (await get('/api/v1/catalog/genres', genresSchema)).items;
    },
  };
}
