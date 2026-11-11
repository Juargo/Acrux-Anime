import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';

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

// What the source knows about one anime. `relations` only comes with its detail.
export interface CatalogAnimeInput extends Omit<AnimeRow, 'relations'> {
  // Every name of the anime in lower case.
  searchText: string;
  members: number;
  adult: boolean;
  relations?: Relation[];
}

// The writing side of the catalog: the load job and the fill on demand (ADR-0043, point 3).
export interface CatalogStore {
  // Whether the detail of each anime the table holds was read, adult titles included.
  // An id the table lacks is not in the answer.
  detailState(ids: readonly number[]): Promise<Map<number, boolean>>;
  // Creates or refreshes the list fields; relations and their date stay as they are.
  saveListed(rows: readonly CatalogAnimeInput[]): Promise<void>;
  // Stores a detail with its relations. An anime it points to that does not point back
  // has an outdated detail, so it is queued to be read again.
  saveDetailed(row: CatalogAnimeInput): Promise<void>;
  // The source no longer has the anime: it stays, and is not asked for again soon.
  markChecked(id: number): Promise<void>;
  // The anime whose detail the load job reads next: never read first, most popular first,
  // then the oldest reads. Adult titles and videos that join no franchise are left out.
  nextToDetail(limit: number): Promise<number[]>;
}

// Formats whose relations nothing follows: music videos, promotional videos and commercials.
const NO_DETAIL_FORMATS = ['MUSIC', 'PV', 'CM'];
const SAVE_BATCH = 100;

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

function listFields(row: CatalogAnimeInput) {
  return {
    title: row.title,
    titleEnglish: row.titleEnglish,
    titleJapanese: row.titleJapanese,
    searchText: row.searchText,
    coverUrl: row.coverUrl,
    format: row.format,
    startDate: row.startDate,
    year: row.year,
    episodes: row.episodes,
    durationMinutes: row.durationMinutes,
    genres: row.genres,
    members: row.members,
    adult: row.adult,
    fetchedAt: new Date(),
  };
}

export function createCatalogRepository(prisma: PrismaClient): CatalogRepository & CatalogStore {
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

    detailState: async (ids) => {
      if (ids.length === 0) return new Map();
      const rows = await prisma.anime.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, detailedAt: true },
      });
      return new Map(rows.map((row) => [row.id, row.detailedAt !== null]));
    },

    saveListed: async (rows) => {
      for (let start = 0; start < rows.length; start += SAVE_BATCH) {
        await prisma.$transaction(
          rows.slice(start, start + SAVE_BATCH).map((row) => {
            const fields = listFields(row);
            return prisma.anime.upsert({
              where: { id: row.id },
              create: { id: row.id, ...fields },
              update: fields,
            });
          }),
        );
      }
    },

    saveDetailed: async (row) => {
      const relations = row.relations ?? [];
      const fields = {
        ...listFields(row),
        relations: relations as object[],
        detailedAt: new Date(),
      };
      const targets = relations.map((relation) => relation.id);
      const pointsBack = JSON.stringify([{ id: row.id }]);
      await prisma.$transaction([
        prisma.anime.upsert({
          where: { id: row.id },
          create: { id: row.id, ...fields },
          update: fields,
        }),
        ...(targets.length === 0
          ? []
          : [
              prisma.$executeRaw`
                UPDATE "anime" SET "detailed_at" = NULL
                WHERE "id" IN (${Prisma.join(targets)})
                  AND "detailed_at" IS NOT NULL
                  AND NOT ("relations" @> ${pointsBack}::jsonb)
              `,
            ]),
      ]);
    },

    markChecked: async (id) => {
      await prisma.anime.updateMany({ where: { id }, data: { detailedAt: new Date() } });
    },

    nextToDetail: async (limit) => {
      const rows = await prisma.anime.findMany({
        where: {
          adult: false,
          OR: [{ format: null }, { format: { notIn: NO_DETAIL_FORMATS } }],
        },
        orderBy: [
          { detailedAt: { sort: 'asc', nulls: 'first' } },
          { members: 'desc' },
          { id: 'asc' },
        ],
        take: limit,
        select: { id: true },
      });
      return rows.map((row) => row.id);
    },
  };
}
