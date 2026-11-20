import type { PrismaClient } from '../../../generated/prisma/client.js';

// One drama as TVmaze describes it (ADR-0046). A show of the index lacks the last three
// fields, which only its detail has.
export interface DramaInput {
  id: number;
  title: string;
  searchText: string;
  summary: string | null;
  coverUrl: string | null;
  tvmazeUrl: string;
  country: string | null;
  language: string | null;
  startDate: Date | null;
  year: number | null;
  durationMinutes: number | null;
  genres: string[];
  status: string | null;
  weight: number;
  imdbId: string | null;
  thetvdbId: number | null;
  sourceUpdatedAt: Date | null;
  aliases?: string[];
  seasons?: number | null;
  episodes?: number | null;
}

export interface DramaStore {
  // Creates or refreshes what the index knows; the aliases, the counts, the names to search
  // by and the date of a detail already read stay as they are.
  saveListed(rows: readonly DramaInput[]): Promise<void>;
  // Stores a detail, with its aliases, seasons and episodes.
  saveDetailed(row: DramaInput): Promise<void>;
  // TVmaze no longer has the drama: it stays, and is not asked for again.
  markChecked(id: number): Promise<void>;
  // The dramas whose detail the load job reads next: the ones never read, most popular
  // first, and then the ones TVmaze changed after their last read.
  nextToDetail(limit: number): Promise<number[]>;
}

// Writes sent at once, so a page of the index does not exhaust the connection pool.
const SAVE_BATCH = 8;

function indexFields(row: DramaInput) {
  return {
    title: row.title,
    summary: row.summary,
    coverUrl: row.coverUrl,
    tvmazeUrl: row.tvmazeUrl,
    country: row.country,
    language: row.language,
    startDate: row.startDate,
    year: row.year,
    durationMinutes: row.durationMinutes,
    genres: row.genres,
    status: row.status,
    weight: row.weight,
    imdbId: row.imdbId,
    thetvdbId: row.thetvdbId,
    sourceUpdatedAt: row.sourceUpdatedAt,
    fetchedAt: new Date(),
  };
}

export function createDramaRepository(prisma: PrismaClient): DramaStore {
  return {
    saveListed: async (rows) => {
      for (let start = 0; start < rows.length; start += SAVE_BATCH) {
        await Promise.all(
          rows.slice(start, start + SAVE_BATCH).map((row) => {
            const fields = indexFields(row);
            return prisma.drama.upsert({
              where: { id: row.id },
              create: { id: row.id, searchText: row.searchText, ...fields },
              update: fields,
            });
          }),
        );
      }
    },

    saveDetailed: async (row) => {
      const fields = {
        ...indexFields(row),
        searchText: row.searchText,
        aliases: row.aliases ?? [],
        seasons: row.seasons ?? null,
        episodes: row.episodes ?? null,
        detailedAt: new Date(),
      };
      await prisma.drama.upsert({
        where: { id: row.id },
        create: { id: row.id, ...fields },
        update: fields,
      });
    },

    markChecked: async (id) => {
      await prisma.drama.updateMany({ where: { id }, data: { detailedAt: new Date() } });
    },

    nextToDetail: async (limit) => {
      const rows = await prisma.drama.findMany({
        where: {
          OR: [{ detailedAt: null }, { sourceUpdatedAt: { gt: prisma.drama.fields.detailedAt } }],
        },
        orderBy: [
          { detailedAt: { sort: 'asc', nulls: 'first' } },
          { weight: 'desc' },
          { id: 'asc' },
        ],
        take: limit,
        select: { id: true },
      });
      return rows.map((row) => row.id);
    },
  };
}
