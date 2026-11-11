import { z } from 'zod';
import type { CatalogAnimeInput, Relation } from '../repositories/catalog.repository.js';

// The MyAnimeList API v2 (ADR-0043). It is called only from the server: it sends no CORS
// headers and its agreement forbids sharing the client id. Shapes confirmed on 2026-11-11.
const BASE_URL = 'https://api.myanimelist.net/v2';
const LIST_FIELDS = [
  'id',
  'title',
  'main_picture',
  'alternative_titles',
  'start_date',
  'media_type',
  'genres',
  'num_episodes',
  'average_episode_duration',
  'nsfw',
  'rating',
  'num_list_users',
].join(',');
// Relations only come with the detail of one anime, never in a list.
const DETAIL_FIELDS = `${LIST_FIELDS},related_anime`;
const SEARCH_LIMIT = 100;
export const RANKING_PAGE_SIZE = 500;
// MyAnimeList answers 400 "invalid q" to a shorter name.
const MIN_SEARCH_LENGTH = 3;
const TIMEOUT_MS = 8000;

const animeSchema = z.object({
  id: z.int().positive(),
  title: z.string(),
  main_picture: z
    .object({ medium: z.string().optional(), large: z.string().optional() })
    .optional(),
  alternative_titles: z
    .object({
      synonyms: z.array(z.string()).optional(),
      en: z.string().optional(),
      ja: z.string().optional(),
    })
    .optional(),
  // YYYY-MM-DD, or YYYY-MM or YYYY when MyAnimeList only knows part of it.
  start_date: z.string().optional(),
  media_type: z.string().optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  num_episodes: z.int().optional(),
  // In seconds.
  average_episode_duration: z.int().optional(),
  nsfw: z.string().optional(),
  rating: z.string().optional(),
  num_list_users: z.int().optional(),
  related_anime: z
    .array(z.object({ node: z.object({ id: z.int().positive() }), relation_type: z.string() }))
    .optional(),
});

const listSchema = z.object({
  data: z.array(z.object({ node: z.unknown() })),
  paging: z.object({ next: z.string().optional() }).optional(),
});

export type SourceAnime = z.input<typeof animeSchema>;

// pv and cm are promotional videos and commercials; they keep their own name so no screen
// shows them as something else.
const FORMATS: Record<string, string> = {
  tv: 'TV',
  movie: 'MOVIE',
  ova: 'OVA',
  ona: 'ONA',
  special: 'SPECIAL',
  tv_special: 'SPECIAL',
  music: 'MUSIC',
  pv: 'PV',
  cm: 'CM',
};

// MyAnimeList sends genres, themes and demographics in one field (77 values). The catalog keeps
// its genres, plus Ecchi; themes, demographics and the erotic genres stay out of the filter, the
// statistics and the badges.
const GENRES = new Set([
  'Action',
  'Adventure',
  'Avant Garde',
  'Award Winning',
  'Boys Love',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Girls Love',
  'Gourmet',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Suspense',
]);

// The relation names of @acrux/domain (RDI-30). A remake comes as an alternative version.
const RELATIONS: Record<string, string> = {
  sequel: 'SEQUEL',
  prequel: 'PREQUEL',
  side_story: 'SIDE_STORY',
  parent_story: 'PARENT',
  full_story: 'PARENT',
  summary: 'SUMMARY',
  alternative_version: 'ALTERNATIVE',
  alternative_setting: 'ALTERNATIVE',
  spin_off: 'SPIN_OFF',
  character: 'CHARACTER',
};

function toStartDate(value: string | undefined): Date | null {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value ?? '');
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2] ?? '01'}-${match[3] ?? '01'}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const positive = (value: number | undefined) => (value !== undefined && value > 0 ? value : null);

export function toCatalogAnime(source: SourceAnime): CatalogAnimeInput {
  const titles = source.alternative_titles ?? {};
  const english = titles.en?.trim() || null;
  const japanese = titles.ja?.trim() || null;
  const names = [source.title, english, japanese, ...(titles.synonyms ?? [])]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase());
  const startDate = toStartDate(source.start_date);
  const seconds = positive(source.average_episode_duration);
  const sourceGenres = (source.genres ?? []).map((genre) => genre.name);
  const relations: Relation[] | undefined = source.related_anime?.map((related) => ({
    type: RELATIONS[related.relation_type] ?? 'OTHER',
    id: related.node.id,
  }));

  return {
    id: source.id,
    title: source.title,
    titleEnglish: english,
    titleJapanese: japanese,
    searchText: [...new Set(names)].join(' '),
    coverUrl: source.main_picture?.large ?? source.main_picture?.medium ?? null,
    format: FORMATS[source.media_type ?? ''] ?? null,
    startDate,
    year: startDate?.getUTCFullYear() ?? null,
    episodes: positive(source.num_episodes),
    durationMinutes: seconds === null ? null : Math.max(1, Math.round(seconds / 60)),
    genres: sourceGenres.filter((genre) => GENRES.has(genre)),
    members: source.num_list_users ?? 0,
    // MyAnimeList marks hentai as nsfw "gray", the same as ecchi: the rating tells them apart.
    adult: source.rating === 'rx' || source.nsfw === 'black' || sourceGenres.includes('Hentai'),
    ...(relations === undefined ? {} : { relations }),
  };
}

export class SourceError extends Error {
  constructor(
    // null when the request itself failed or timed out.
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'SourceError';
  }

  // MyAnimeList is refusing requests: every caller stops asking for a while (S7).
  get blocked(): boolean {
    return this.status === 403 || this.status === 429;
  }
}

export interface CatalogSource {
  // null when MyAnimeList does not have the anime.
  detail(id: number): Promise<CatalogAnimeInput | null>;
  // List fields only, without relations; empty for a name MyAnimeList would reject.
  search(name: string): Promise<CatalogAnimeInput[]>;
  // One page of every anime, most popular first.
  ranking(offset: number): Promise<{ items: CatalogAnimeInput[]; hasNext: boolean }>;
}

export function createMyAnimeListSource({
  clientId,
  fetchFn = fetch,
}: {
  clientId: string;
  fetchFn?: typeof fetch;
}): CatalogSource {
  async function get(path: string, params: Record<string, string>): Promise<unknown | null> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: { 'X-MAL-CLIENT-ID': clientId },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new SourceError(null, `MyAnimeList request failed: ${String(error)}`);
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new SourceError(response.status, `MyAnimeList ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new SourceError(null, 'MyAnimeList sent a body that is not JSON');
    }
  }

  // One unreadable item does not take the page away.
  function toList(body: unknown): { items: CatalogAnimeInput[]; hasNext: boolean } {
    const list = listSchema.safeParse(body);
    if (!list.success) throw new SourceError(null, 'MyAnimeList sent an unexpected list');
    const items: CatalogAnimeInput[] = [];
    for (const { node } of list.data.data) {
      const anime = animeSchema.safeParse(node);
      if (anime.success) items.push(toCatalogAnime(anime.data));
    }
    return { items, hasNext: list.data.paging?.next !== undefined };
  }

  return {
    detail: async (id) => {
      const body = await get(`/anime/${id}`, { fields: DETAIL_FIELDS });
      if (body === null) return null;
      const anime = animeSchema.safeParse(body);
      if (!anime.success) throw new SourceError(null, 'MyAnimeList sent an unexpected anime');
      // A detail always states its relations, even when it has none.
      return { relations: [], ...toCatalogAnime(anime.data) };
    },
    search: async (name) => {
      const q = name.trim();
      if (q.length < MIN_SEARCH_LENGTH) return [];
      const body = await get('/anime', {
        q,
        limit: String(SEARCH_LIMIT),
        nsfw: 'true',
        fields: LIST_FIELDS,
      });
      return toList(body).items;
    },
    ranking: async (offset) =>
      toList(
        await get('/anime/ranking', {
          ranking_type: 'bypopularity',
          offset: String(offset),
          limit: String(RANKING_PAGE_SIZE),
          nsfw: 'true',
          fields: LIST_FIELDS,
        }),
      ),
  };
}
