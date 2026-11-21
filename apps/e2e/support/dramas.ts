// The drama API intercepted with context.route() (ADR-0046): the browser's calls to
// /api/v1/dramas/** get fixed answers with the same shapes as apps/api/src/modules/dramas.
// Nothing loads TVmaze data into the test database: support/start-api.ts only writes the rows
// of DRAMAS, so the real API can mark them (#154). Covers come from the host that
// installCatalog already answers.
import type { BrowserContext, Route } from '@playwright/test';

interface Drama {
  id: number;
  title: string;
  origin: 'KR' | 'JP' | 'CN' | null;
  year: number | null;
  // Null until the loader reads the detail of the show.
  seasons: number | null;
  episodes: number | null;
  genres: string[];
}

export const DRAMAS: Drama[] = [
  {
    id: 38963,
    title: 'Crash Landing on You',
    origin: 'KR',
    year: 2019,
    seasons: 1,
    episodes: 16,
    genres: ['Drama', 'Romance'],
  },
  {
    id: 52341,
    title: 'Alice in Borderland',
    origin: 'JP',
    year: 2020,
    seasons: 3,
    episodes: 24,
    genres: ['Drama', 'Thriller'],
  },
  // Listed by TVmaze but its detail is not read yet: no seasons and no episodes.
  {
    id: 71002,
    title: 'The Untold Palace',
    origin: 'CN',
    year: 2023,
    seasons: null,
    episodes: null,
    genres: ['Drama'],
  },
];

const coverOf = (id: number) => `https://covers.e2e.test/dramas/e2e-${id}.png`;

function toJson(drama: Drama) {
  return {
    ...drama,
    aliases: [],
    summary: null,
    coverUrl: coverOf(drama.id),
    tvmazeUrl: `https://www.tvmaze.com/shows/${drama.id}`,
    country: drama.origin,
    language: null,
  };
}

export function answer(url: URL): unknown {
  const { pathname, searchParams: params } = url;
  if (pathname === '/api/v1/dramas') {
    const search = params.get('search')?.toLowerCase();
    const origin = params.get('origin');
    const genres = params.get('genres')?.split(',') ?? [];
    const items = DRAMAS.filter(
      (drama) =>
        (!search || drama.title.toLowerCase().includes(search)) &&
        (!origin || drama.origin === origin) &&
        genres.every((genre) => drama.genres.includes(genre)),
    );
    return { items: items.map(toJson), nextPage: null };
  }
  if (pathname === '/api/v1/dramas/by-ids') {
    const ids = (params.get('ids') ?? '').split(',').map(Number);
    return {
      items: DRAMAS.filter((drama) => ids.includes(drama.id)).map(toJson),
      missing: ids.filter((id) => !DRAMAS.some((drama) => drama.id === id)),
    };
  }
  if (pathname === '/api/v1/dramas/genres') {
    return { items: ['Drama', 'Romance', 'Thriller'] };
  }
  throw new Error(`Unknown drama route: ${pathname}`);
}

async function dramas(route: Route) {
  try {
    return await route.fulfill({ status: 200, json: answer(new URL(route.request().url())) });
  } catch (error) {
    return route.fulfill({
      status: 400,
      json: { code: 'dramas.invalid_query', detail: String(error) },
    });
  }
}

export async function installDramas(context: BrowserContext) {
  await context.route((url) => url.pathname.startsWith('/api/v1/dramas'), dramas);
}
