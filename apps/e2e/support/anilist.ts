// AniList intercepted with page.route() (ADR-0029, ADR-0037): the browser's GraphQL calls get
// fixed answers built from the few anime below, keyed by the operation name of each query
// in apps/web/src/anilist. Covers come back as a tiny PNG with CORS, so the card renders.
import type { BrowserContext, Route } from '@playwright/test';

interface Anime {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null; native: string | null };
  format: string;
  startDate: { year: number; month: number; day: number };
  episodes: number;
  // Minutes per episode; 24 unless given.
  duration?: number;
  genres: string[];
  relations: { relationType: string; id: number }[];
}

// "Sousou no Frieren" has two seasons in AniList (@CA-RF12-01): one franchise, two entries.
export const FRIEREN = {
  title: "Frieren: Beyond Journey's End",
  search: 'frieren',
  rootId: 154587,
} as const;

// "Spy x Family" Part 1 → Part 2, only for the curator journey (#42): its correction stays in
// the database, so no other journey uses this saga.
export const SPY_FAMILY = { rootId: 140960, part2Id: 142838 } as const;

const ANIME: Anime[] = [
  {
    id: 154587,
    idMal: 52991,
    title: {
      romaji: 'Sousou no Frieren',
      english: "Frieren: Beyond Journey's End",
      native: '葬送のフリーレン',
    },
    format: 'TV',
    startDate: { year: 2023, month: 9, day: 29 },
    episodes: 28,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    relations: [{ relationType: 'SEQUEL', id: 182255 }],
  },
  {
    id: 182255,
    idMal: 59978,
    title: {
      romaji: 'Sousou no Frieren 2nd Season',
      english: "Frieren: Beyond Journey's End Season 2",
      native: '葬送のフリーレン 第2期',
    },
    format: 'TV',
    startDate: { year: 2026, month: 1, day: 16 },
    episodes: 10,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    relations: [{ relationType: 'PREQUEL', id: 154587 }],
  },
  {
    id: 140960,
    idMal: 50265,
    title: { romaji: 'SPY×FAMILY', english: 'SPY x FAMILY', native: 'SPY×FAMILY' },
    format: 'TV',
    startDate: { year: 2022, month: 4, day: 9 },
    episodes: 12,
    genres: ['Action', 'Comedy'],
    relations: [{ relationType: 'SEQUEL', id: 142838 }],
  },
  {
    id: 142838,
    idMal: 50602,
    title: {
      romaji: 'SPY×FAMILY Part 2',
      english: 'SPY x FAMILY Cour 2',
      native: 'SPY×FAMILY 第2クール',
    },
    format: 'TV',
    startDate: { year: 2022, month: 10, day: 1 },
    episodes: 13,
    genres: ['Action', 'Comedy'],
    relations: [{ relationType: 'PREQUEL', id: 140960 }],
  },
];

const byId = new Map(ANIME.map((anime) => [anime.id, anime]));
const coverOf = (id: number) =>
  `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/e2e-${id}.png`;

// MEDIA_FIELDS of apps/web/src/anilist/catalog.ts.
function mediaFields(anime: Anime) {
  return {
    id: anime.id,
    idMal: anime.idMal,
    type: 'ANIME',
    format: anime.format,
    isAdult: false,
    title: anime.title,
    coverImage: { large: coverOf(anime.id) },
    startDate: anime.startDate,
  };
}

function withRelations(anime: Anime) {
  return {
    ...mediaFields(anime),
    relations: {
      edges: anime.relations.flatMap(({ relationType, id }) => {
        const node = byId.get(id);
        return node ? [{ relationType, node: mediaFields(node) }] : [];
      }),
    },
  };
}

interface GraphQLBody {
  query: string;
  variables: Record<string, unknown>;
}

function idsOf(variables: Record<string, unknown>): Anime[] {
  const ids = Array.isArray(variables.ids) ? (variables.ids as number[]) : [];
  return ids.flatMap((id) => byId.get(id) ?? []);
}

function matches(anime: Anime, variables: Record<string, unknown>): boolean {
  const search = typeof variables.search === 'string' ? variables.search.toLowerCase() : null;
  if (search) {
    return Object.values(anime.title).some((title) => title?.toLowerCase().includes(search));
  }
  return anime.startDate.year === variables.seasonYear;
}

export function answer({ query, variables }: GraphQLBody): unknown {
  if (query.includes('query CatalogPage')) {
    return {
      Page: {
        pageInfo: { hasNextPage: false },
        media: ANIME.filter((anime) => matches(anime, variables)).map(withRelations),
      },
    };
  }
  if (query.includes('query FranchiseMedia')) {
    return {
      Page: {
        media: idsOf(variables).map((anime) => ({
          ...withRelations(anime),
          episodes: anime.episodes,
          genres: anime.genres,
        })),
      },
    };
  }
  if (query.includes('query MediaByIds')) {
    return {
      Page: {
        media: idsOf(variables).map((anime) => ({
          id: anime.id,
          idMal: anime.idMal,
          title: anime.title,
          coverImage: { large: coverOf(anime.id) },
          format: anime.format,
          seasonYear: anime.startDate.year,
        })),
      },
    };
  }
  if (query.includes('query MediaStats')) {
    return {
      Page: {
        media: idsOf(variables).map((anime) => ({
          id: anime.id,
          format: anime.format,
          seasonYear: anime.startDate.year,
          episodes: anime.episodes,
          duration: anime.duration ?? 24,
          genres: anime.genres,
        })),
      },
    };
  }
  if (query.includes('query Genres')) {
    return { GenreCollection: ['Action', 'Adventure', 'Drama', 'Fantasy', 'Hentai'] };
  }
  throw new Error(`Unknown AniList query: ${query.slice(0, 80)}`);
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept',
};

// 1 × 1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function graphql(route: Route) {
  const request = route.request();
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  try {
    const data = answer(request.postDataJSON() as GraphQLBody);
    return route.fulfill({ status: 200, headers: CORS, json: { data } });
  } catch (error) {
    return route.fulfill({
      status: 400,
      headers: CORS,
      json: { data: null, errors: [{ message: String(error) }] },
    });
  }
}

export async function installAniList(context: BrowserContext) {
  await context.route('https://graphql.anilist.co/**', graphql);
  await context.route('https://s4.anilist.co/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'image/png' },
      body: PNG,
    }),
  );
}
