import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { searchKey } from '../search-key.js';

// The read side of the drama table (ADR-0046). The API role can only SELECT from it.
export const ORIGINS = ['KR', 'JP', 'CN'] as const;
export type Origin = (typeof ORIGINS)[number];

// TVmaze has no adult flag, only this genre. RF-11: adult content is never served.
const ADULT_GENRE = 'Adult';
// The language tells the origin of a drama whose network has no country.
const ORIGIN_LANGUAGE: Record<Origin, string> = { KR: 'Korean', JP: 'Japanese', CN: 'Chinese' };

export interface DramaRow {
  id: number;
  title: string;
  aliases: string[];
  summary: string | null;
  coverUrl: string | null;
  tvmazeUrl: string;
  country: string | null;
  language: string | null;
  // Derived: the country when it is one of the three, else the language when there is no country.
  origin: Origin | null;
  year: number | null;
  seasons: number | null;
  episodes: number | null;
  genres: string[];
}

export interface DramaBrowseQuery {
  // Part of the title or of an alias; case, accents and tone marks do not count.
  search?: string;
  origin?: Origin;
  genres: string[];
  offset: number;
  limit: number;
}

export interface DramaCatalogRepository {
  // Most popular first. Adult dramas never come out.
  browse(query: DramaBrowseQuery): Promise<DramaRow[]>;
  // The dramas the table holds among the ids, adult ones left out.
  byIds(ids: readonly number[]): Promise<DramaRow[]>;
  // The genres of the dramas served, in alphabetical order.
  genres(): Promise<string[]>;
}

const select = {
  id: true,
  title: true,
  aliases: true,
  summary: true,
  coverUrl: true,
  tvmazeUrl: true,
  country: true,
  language: true,
  year: true,
  seasons: true,
  episodes: true,
  genres: true,
} as const;

const isOrigin = (value: string | null): value is Origin =>
  ORIGINS.some((origin) => origin === value);

function originOf(country: string | null, language: string | null): Origin | null {
  if (isOrigin(country)) return country;
  if (country !== null) return null;
  return ORIGINS.find((origin) => ORIGIN_LANGUAGE[origin] === language) ?? null;
}

const notAdult: Prisma.DramaWhereInput = { NOT: { genres: { has: ADULT_GENRE } } };

function inOrigin(origin: Origin): Prisma.DramaWhereInput {
  return { OR: [{ country: origin }, { country: null, language: ORIGIN_LANGUAGE[origin] }] };
}

// search_text holds search keys; LIKE wildcards in the name are plain characters.
function named(search: string): Prisma.DramaWhereInput {
  return { searchText: { contains: searchKey(search).replace(/[\\%_]/g, '\\$&') } };
}

function toRow(row: Omit<DramaRow, 'origin'>): DramaRow {
  return { ...row, origin: originOf(row.country, row.language) };
}

export function createDramaCatalogRepository(prisma: PrismaClient): DramaCatalogRepository {
  return {
    browse: async ({ search, origin, genres, offset, limit }) => {
      const rows = await prisma.drama.findMany({
        where: {
          AND: [
            notAdult,
            ...(search === undefined ? [] : [named(search)]),
            ...(origin === undefined ? [] : [inOrigin(origin)]),
            ...(genres.length === 0 ? [] : [{ genres: { hasSome: genres } }]),
          ],
        },
        orderBy: [{ weight: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        select,
      });
      return rows.map(toRow);
    },

    byIds: async (ids) => {
      const rows = await prisma.drama.findMany({
        where: { AND: [notAdult, { id: { in: [...ids] } }] },
        select,
      });
      return rows.map(toRow);
    },

    genres: async () => {
      const rows = await prisma.$queryRaw<{ genre: string }[]>`
        SELECT DISTINCT unnest("genres") AS genre FROM "drama"
        WHERE NOT ${ADULT_GENRE} = ANY("genres") ORDER BY genre
      `;
      return rows.map((row) => row.genre);
    },
  };
}
