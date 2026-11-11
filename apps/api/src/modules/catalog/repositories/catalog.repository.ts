import { z } from 'zod';
import type { PrismaClient } from '../../../generated/prisma/client.js';

// A link to another anime; the type uses the relation names of @acrux/domain.
export interface Relation {
  type: string;
  id: number;
}

// One anime of the catalog copied from MyAnimeList (ADR-0043); the id is MyAnimeList's.
export interface AnimeRow {
  id: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  coverUrl: string | null;
  // TV, MOVIE, OVA, ONA, SPECIAL or MUSIC; null when the source does not know it.
  format: string | null;
  // A partial date is stored as its first day; null when unknown.
  startDate: Date | null;
  year: number | null;
  episodes: number | null;
  durationMinutes: number | null;
  genres: string[];
  // Empty until the detail of the anime has been read from the source.
  relations: Relation[];
}

export interface BrowseQuery {
  // Part of any of the names of the anime.
  search?: string;
  year?: number;
  // Any of them; empty means every genre.
  genres: string[];
  formats: string[];
  offset: number;
  limit: number;
}

export interface CatalogRepository {
  // Most popular first. Adult titles never come out of the catalog (RF-11).
  browse(query: BrowseQuery): Promise<AnimeRow[]>;
  // In no particular order; unknown ids are left out.
  byIds(ids: readonly number[]): Promise<AnimeRow[]>;
  // Every genre of the titles the catalog shows, in alphabetical order.
  genres(): Promise<string[]>;
}

const columns = {
  id: true,
  title: true,
  titleEnglish: true,
  titleJapanese: true,
  coverUrl: true,
  format: true,
  startDate: true,
  year: true,
  episodes: true,
  durationMinutes: true,
  genres: true,
  relations: true,
} as const;

const relationsSchema = z.array(z.object({ type: z.string(), id: z.int().positive() }));

type StoredRow = Omit<AnimeRow, 'relations'> & { relations: unknown };

// A row with relations in an unexpected shape still belongs to the catalog.
function toRow(stored: StoredRow): AnimeRow {
  const relations = relationsSchema.safeParse(stored.relations);
  return { ...stored, relations: relations.success ? relations.data : [] };
}

// search_text is stored in lower case; LIKE wildcards in the name are plain characters.
const likePattern = (search: string) => search.toLowerCase().replace(/[\\%_]/g, '\\$&');

export function createCatalogRepository(prisma: PrismaClient): CatalogRepository {
  return {
    browse: async ({ search, year, genres, formats, offset, limit }) => {
      const rows = await prisma.anime.findMany({
        where: {
          adult: false,
          format: { in: formats },
          ...(search === undefined ? {} : { searchText: { contains: likePattern(search) } }),
          ...(year === undefined ? {} : { year }),
          ...(genres.length === 0 ? {} : { genres: { hasSome: genres } }),
        },
        orderBy: [{ members: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        select: columns,
      });
      return rows.map(toRow);
    },
    byIds: async (ids) => {
      if (ids.length === 0) return [];
      const rows = await prisma.anime.findMany({
        where: { id: { in: [...ids] }, adult: false },
        select: columns,
      });
      return rows.map(toRow);
    },
    genres: async () => {
      const rows = await prisma.$queryRaw<{ genre: string }[]>`
        SELECT DISTINCT unnest("genres") AS genre FROM "anime" WHERE NOT "adult" ORDER BY genre
      `;
      return rows.map((row) => row.genre);
    },
  };
}
