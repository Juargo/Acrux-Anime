import type { PrismaClient } from '../../../generated/prisma/client.js';

export type MarkStatus = 'seen' | 'watching';

export interface MarkView {
  animeId: number;
  malId: number | null;
  status: MarkStatus;
  markedAt: Date;
}

// `malId` left out (or undefined) keeps the stored one; `null` clears it.
export interface MarkEntry {
  animeId: number;
  malId?: number | null | undefined;
}

// One page of marks: the ones after `after` (an animeId), at most `limit`.
export interface MarkPageQuery {
  after?: number | undefined;
  limit: number;
}

export interface MarkPage {
  items: MarkView[];
  // The animeId to continue after, or null on the last page.
  nextCursor: number | null;
}

// Prisma connects as acrux_api, which RLS does not restrict in practice: every query
// takes the user id from the session and filters by it (ADR-0028).
export interface MarksRepository {
  // Ordered by animeId.
  list(userId: string, page: MarkPageQuery): Promise<MarkPage>;
  // One statement, so the entries are written all together or not at all. The same
  // status keeps markedAt; a new status sets it to now(). The profile must exist.
  upsert(userId: string, status: MarkStatus, entries: MarkEntry[]): Promise<MarkView[]>;
  remove(userId: string, animeIds: number[]): Promise<void>;
}

const byAnimeId = (a: MarkView, b: MarkView) => a.animeId - b.animeId;

export function createMarksRepository(prisma: PrismaClient): MarksRepository {
  return {
    list: async (userId, { after, limit }) => {
      // One row more than the page tells whether another page follows.
      const rows = await prisma.mark.findMany({
        where: { userId, ...(after === undefined ? {} : { animeId: { gt: after } }) },
        orderBy: { animeId: 'asc' },
        take: limit + 1,
        select: { animeId: true, malId: true, status: true, markedAt: true },
      });
      const items = rows.slice(0, limit);
      return {
        items,
        nextCursor: rows.length > limit ? (items.at(-1)?.animeId ?? null) : null,
      };
    },

    upsert: async (userId, status, entries) => {
      const animeIds = entries.map((entry) => entry.animeId);
      const malIds = entries.map((entry) => entry.malId ?? null);
      const malIdSent = entries.map((entry) => entry.malId !== undefined);
      const rows = await prisma.$queryRaw<MarkView[]>`
        WITH entry AS (
          SELECT * FROM unnest(${animeIds}::int[], ${malIds}::int[], ${malIdSent}::boolean[])
            AS e(anime_id, mal_id, mal_id_sent)
        )
        INSERT INTO mark AS m (user_id, anime_id, mal_id, status)
        SELECT ${userId}::uuid, entry.anime_id, entry.mal_id, ${status}::mark_status FROM entry
        ON CONFLICT (user_id, anime_id) DO UPDATE SET
          mal_id = CASE
            WHEN (SELECT entry.mal_id_sent FROM entry WHERE entry.anime_id = excluded.anime_id)
            THEN excluded.mal_id
            ELSE m.mal_id
          END,
          marked_at = CASE WHEN m.status = excluded.status THEN m.marked_at ELSE now() END,
          status = excluded.status
        RETURNING m.anime_id AS "animeId", m.mal_id AS "malId",
          m.status::text AS "status", m.marked_at AS "markedAt"`;
      return rows.sort(byAnimeId);
    },

    remove: async (userId, animeIds) => {
      await prisma.mark.deleteMany({ where: { userId, animeId: { in: animeIds } } });
    },
  };
}
