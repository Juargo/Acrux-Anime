import { z } from 'zod';
import { SourceError } from '../../catalog/source-error.js';
import type { DramaInput } from '../repositories/drama.repository.js';
import { searchKey } from '../search-key.js';

// The public TVmaze API (ADR-0046), called only from the server. It needs no key and its
// data is CC BY-SA 4.0. It allows at least 20 requests every 10 seconds per IP and answers
// 429 above that. Shapes confirmed on 2026-11-20.
const BASE_URL = 'https://api.tvmaze.com';
// A page of the index weighs about 350 kB.
const TIMEOUT_MS = 20_000;

// TVmaze cannot filter by country or language, so the whole index is read and filtered here.
const TYPE = 'Scripted';
const COUNTRIES = new Set(['KR', 'JP', 'CN']);
// What tells the origin of a show on a global platform, which has no country.
const LANGUAGES = new Set(['Korean', 'Japanese', 'Chinese']);

const channelSchema = z.object({ country: z.object({ code: z.string() }).nullish() }).nullish();

const showSchema = z.object({
  id: z.int().positive(),
  url: z.string(),
  name: z.string(),
  type: z.string().nullish(),
  language: z.string().nullish(),
  genres: z.array(z.string()).nullish(),
  status: z.string().nullish(),
  // In minutes.
  runtime: z.number().nullish(),
  averageRuntime: z.number().nullish(),
  // YYYY-MM-DD.
  premiered: z.string().nullish(),
  weight: z.number().nullish(),
  // A broadcaster, or a streaming platform; a global platform has no country.
  network: channelSchema,
  webChannel: channelSchema,
  externals: z.object({ thetvdb: z.int().nullish(), imdb: z.string().nullish() }).nullish(),
  image: z.object({ medium: z.string().nullish(), original: z.string().nullish() }).nullish(),
  // HTML.
  summary: z.string().nullish(),
  // Seconds since 1970, when TVmaze last changed the show or anything under it.
  updated: z.number().nullish(),
});

// Aliases, seasons and episodes only come embedded in the detail of one show.
const detailSchema = showSchema.extend({
  _embedded: z
    .object({
      akas: z.array(z.object({ name: z.string() })).nullish(),
      seasons: z.array(z.unknown()).nullish(),
      // The regular episodes; TVmaze lists specials apart.
      episodes: z.array(z.unknown()).nullish(),
    })
    .nullish(),
});

export type SourceShow = z.input<typeof showSchema>;
type SourceDetail = z.input<typeof detailSchema>;

const countryOf = (show: SourceShow) =>
  show.network?.country?.code ?? show.webChannel?.country?.code ?? null;

// The scope of ADR-0046: scripted shows of Korea, Japan and China, plus the ones without
// country in their languages. A show of another country stays out, whatever its language.
export function isWanted(show: SourceShow): boolean {
  if (show.type !== TYPE) return false;
  const country = countryOf(show);
  return country === null ? LANGUAGES.has(show.language ?? '') : COUNTRIES.has(country);
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

function toPlainText(html: string | null | undefined): string | null {
  const text = (html ?? '')
    .replace(/<\/p>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

function toStartDate(value: string | null | undefined): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // A day that does not exist, or a year before television, is not a date to store.
  const real = date.toISOString().startsWith(`${value}T`) && date.getUTCFullYear() >= 1900;
  return real ? date : null;
}

const positive = (value: number | null | undefined) =>
  typeof value === 'number' && value > 0 ? Math.round(value) : null;

const searchTextOf = (names: readonly string[]) => [...new Set(names.map(searchKey))].join(' ');

export function toDrama(source: SourceShow): DramaInput {
  const startDate = toStartDate(source.premiered);
  const updated = positive(source.updated);
  return {
    id: source.id,
    title: source.name,
    searchText: searchTextOf([source.name]),
    summary: toPlainText(source.summary),
    coverUrl: source.image?.original ?? source.image?.medium ?? null,
    tvmazeUrl: source.url,
    country: countryOf(source),
    language: source.language ?? null,
    startDate,
    year: startDate?.getUTCFullYear() ?? null,
    durationMinutes: positive(source.averageRuntime) ?? positive(source.runtime),
    genres: source.genres ?? [],
    status: source.status ?? null,
    weight: positive(source.weight) ?? 0,
    imdbId: source.externals?.imdb ?? null,
    thetvdbId: source.externals?.thetvdb ?? null,
    sourceUpdatedAt: updated === null ? null : new Date(updated * 1000),
  };
}

function toDetailedDrama(source: SourceDetail): DramaInput {
  const drama = toDrama(source);
  const embedded = source._embedded ?? {};
  const aliases: string[] = [];
  for (const { name } of embedded.akas ?? []) {
    const alias = name.trim();
    if (alias && alias !== drama.title && !aliases.includes(alias)) aliases.push(alias);
  }
  return {
    ...drama,
    aliases,
    searchText: searchTextOf([drama.title, ...aliases]),
    seasons: positive(embedded.seasons?.length),
    episodes: positive(embedded.episodes?.length),
  };
}

export interface DramaSource {
  // The wanted shows of one page of the whole index, with the fields a list has. After the
  // last page it answers no shows and no next page.
  index(page: number): Promise<{ items: DramaInput[]; hasNext: boolean }>;
  // With aliases, seasons and episodes; null when TVmaze does not have the show.
  detail(id: number): Promise<DramaInput | null>;
}

export function createTvmazeSource({
  fetchFn = fetch,
}: {
  fetchFn?: typeof fetch;
} = {}): DramaSource {
  async function get(path: string, params: [string, string][]): Promise<unknown | null> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [name, value] of params) url.searchParams.append(name, value);
    let response: Response;
    try {
      response = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new SourceError(null, `TVmaze request failed: ${String(error)}`);
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new SourceError(response.status, `TVmaze ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new SourceError(null, 'TVmaze sent a body that is not JSON');
    }
  }

  return {
    index: async (page) => {
      const body = await get('/shows', [['page', String(page)]]);
      // TVmaze answers 404 to the page after the last one.
      if (body === null) return { items: [], hasNext: false };
      if (!Array.isArray(body)) throw new SourceError(null, 'TVmaze sent an unexpected index');
      const items: DramaInput[] = [];
      // One unreadable show does not take the page away.
      for (const entry of body) {
        const show = showSchema.safeParse(entry);
        if (show.success && isWanted(show.data)) items.push(toDrama(show.data));
      }
      return { items, hasNext: true };
    },
    detail: async (id) => {
      const body = await get(`/shows/${id}`, [
        ['embed[]', 'akas'],
        ['embed[]', 'seasons'],
        ['embed[]', 'episodes'],
      ]);
      if (body === null) return null;
      const show = detailSchema.safeParse(body);
      if (!show.success) throw new SourceError(null, 'TVmaze sent an unexpected show');
      return toDetailedDrama(show.data);
    },
  };
}
