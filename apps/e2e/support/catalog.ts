// The catalog API intercepted with page.route() (ADR-0029, ADR-0037, ADR-0043): the browser's
// calls to /api/v1/catalog/** get fixed answers built from the few anime below, with the same
// shapes as apps/api/src/modules/catalog. The real API serves an empty catalog here, because
// nothing loads MyAnimeList data into the test database. Covers come back as a tiny PNG with
// CORS, so the card renders.
import type { BrowserContext, Route } from '@playwright/test';

interface Anime {
  id: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  format: string;
  startDate: string;
  episodes: number;
  // Minutes per episode; 24 unless given.
  durationMinutes?: number;
  genres: string[];
  relations: { type: string; id: number }[];
}

// "Sousou no Frieren" has two seasons (@CA-RF12-01): one franchise, two entries.
export const FRIEREN = {
  title: "Frieren: Beyond Journey's End",
  search: 'frieren',
  rootId: 154587,
} as const;

// "Spy x Family" Part 1 -> Part 2, only for the curator journey (#42): its correction stays in
// the database, so no other journey uses this saga.
export const SPY_FAMILY = { rootId: 140960, part2Id: 142838 } as const;

const ANIME: Anime[] = [
  {
    id: 154587,
    title: 'Sousou no Frieren',
    titleEnglish: "Frieren: Beyond Journey's End",
    titleJapanese: '葬送のフリーレン',
    format: 'TV',
    startDate: '2023-09-29',
    episodes: 28,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    relations: [{ type: 'SEQUEL', id: 182255 }],
  },
  {
    id: 182255,
    title: 'Sousou no Frieren 2nd Season',
    titleEnglish: "Frieren: Beyond Journey's End Season 2",
    titleJapanese: '葬送のフリーレン 第2期',
    format: 'TV',
    startDate: '2026-01-16',
    episodes: 10,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    relations: [{ type: 'PREQUEL', id: 154587 }],
  },
  {
    id: 140960,
    title: 'SPY×FAMILY',
    titleEnglish: 'SPY x FAMILY',
    titleJapanese: 'SPY×FAMILY',
    format: 'TV',
    startDate: '2022-04-09',
    episodes: 12,
    genres: ['Action', 'Comedy'],
    relations: [{ type: 'SEQUEL', id: 142838 }],
  },
  {
    id: 142838,
    title: 'SPY×FAMILY Part 2',
    titleEnglish: 'SPY x FAMILY Cour 2',
    titleJapanese: 'SPY×FAMILY 第2クール',
    format: 'TV',
    startDate: '2022-10-01',
    episodes: 13,
    genres: ['Action', 'Comedy'],
    relations: [{ type: 'PREQUEL', id: 140960 }],
  },
];

const byId = new Map(ANIME.map((anime) => [anime.id, anime]));
const coverOf = (id: number) => `https://covers.e2e.test/anime/e2e-${id}.png`;

// CatalogAnime of apps/api/src/modules/catalog.
function toJson(anime: Anime) {
  return {
    id: anime.id,
    title: anime.title,
    titleEnglish: anime.titleEnglish,
    titleJapanese: anime.titleJapanese,
    coverUrl: coverOf(anime.id),
    format: anime.format,
    startDate: anime.startDate,
    year: Number(anime.startDate.slice(0, 4)),
    episodes: anime.episodes,
    durationMinutes: anime.durationMinutes ?? 24,
    genres: anime.genres,
    relations: anime.relations,
  };
}

// The neighbours one hop away that `items` lacks.
function neighbours(items: readonly Anime[]) {
  const have = new Set(items.map((anime) => anime.id));
  const ids = new Set(
    items
      .flatMap((anime) => anime.relations.map((relation) => relation.id))
      .filter((id) => !have.has(id)),
  );
  return [...ids].flatMap((id) => byId.get(id) ?? []);
}

function idsOf(params: URLSearchParams, name: string): number[] {
  return (params.get(name) ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
}

function matches(anime: Anime, params: URLSearchParams): boolean {
  const search = params.get('search')?.toLowerCase();
  if (search) {
    return [anime.title, anime.titleEnglish, anime.titleJapanese].some((title) =>
      title?.toLowerCase().includes(search),
    );
  }
  return anime.startDate.startsWith(`${params.get('year')}-`);
}

// Follows sequels and prequels from the seeds, as the franchises route does.
function crawl(seeds: number[]) {
  const items = new Map<number, Anime>();
  const missing: number[] = [];
  const frontier = [...new Set(seeds)];
  while (frontier.length > 0) {
    const id = frontier.shift() as number;
    if (items.has(id) || missing.includes(id)) continue;
    const anime = byId.get(id);
    if (!anime) {
      missing.push(id);
      continue;
    }
    items.set(id, anime);
    for (const relation of anime.relations) {
      if (['SEQUEL', 'PREQUEL'].includes(relation.type)) frontier.push(relation.id);
    }
  }
  const reached = [...items.values()];
  return { items: reached, related: neighbours(reached), missing, pending: [] as number[] };
}

export function answer(url: URL): unknown {
  const { pathname, searchParams: params } = url;
  if (pathname === '/api/v1/catalog/anime') {
    const items = ANIME.filter((anime) => matches(anime, params));
    return { items: items.map(toJson), related: neighbours(items).map(toJson), nextPage: null };
  }
  if (pathname === '/api/v1/catalog/anime/by-ids') {
    return {
      items: idsOf(params, 'ids')
        .flatMap((id) => byId.get(id) ?? [])
        .map(toJson),
    };
  }
  if (pathname === '/api/v1/catalog/franchises') {
    const { items, related, missing, pending } = crawl(idsOf(params, 'seeds'));
    return { items: items.map(toJson), related: related.map(toJson), missing, pending };
  }
  if (pathname === '/api/v1/catalog/genres') {
    return { items: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Hentai'] };
  }
  throw new Error(`Unknown catalog route: ${pathname}`);
}

// 1 x 1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function catalog(route: Route) {
  try {
    return await route.fulfill({ status: 200, json: answer(new URL(route.request().url())) });
  } catch (error) {
    return route.fulfill({
      status: 400,
      json: { code: 'catalog.invalid_query', detail: String(error) },
    });
  }
}

export async function installCatalog(context: BrowserContext) {
  await context.route((url) => url.pathname.startsWith('/api/v1/catalog/'), catalog);
  await context.route('https://covers.e2e.test/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'image/png' },
      body: PNG,
    }),
  );
}
