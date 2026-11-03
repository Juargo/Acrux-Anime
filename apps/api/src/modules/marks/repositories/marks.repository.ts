import type { PrismaClient } from '../../../generated/prisma/client.js';

export type MarkStatus = 'seen' | 'watching';

export interface MarkView {
  anilistId: number;
  malId: number | null;
  status: MarkStatus;
  markedAt: Date;
}

// `malId` left out (or undefined) keeps the stored one; `null` clears it.
export interface MarkEntry {
  anilistId: number;
  malId?: number | null | undefined;
}

// Prisma connects as acrux_api, which RLS does not restrict in practice: every query
// takes the user id from the session and filters by it (ADR-0028).
export interface MarksRepository {
  list(userId: string): Promise<MarkView[]>;
  // One statement, so the entries are written all together or not at all. The same
  // status keeps markedAt; a new status sets it to now(). The profile must exist.
  upsert(userId: string, status: MarkStatus, entries: MarkEntry[]): Promise<MarkView[]>;
  remove(userId: string, anilistIds: number[]): Promise<void>;
}

const byAnilistId = (a: MarkView, b: MarkView) => a.anilistId - b.anilistId;

export function createMarksRepository(prisma: PrismaClient): MarksRepository {
  return {
    list: (userId) =>
      prisma.mark.findMany({
        where: { userId },
        orderBy: { anilistId: 'asc' },
        select: { anilistId: true, malId: true, status: true, markedAt: true },
      }),

    upsert: async (userId, status, entries) => {
      const anilistIds = entries.map((entry) => entry.anilistId);
      const malIds = entries.map((entry) => entry.malId ?? null);
      const malIdSent = entries.map((entry) => entry.malId !== undefined);
      const rows = await prisma.$queryRaw<MarkView[]>`
        WITH entry AS (
          SELECT * FROM unnest(${anilistIds}::int[], ${malIds}::int[], ${malIdSent}::boolean[])
            AS e(anilist_id, mal_id, mal_id_sent)
        )
        INSERT INTO mark AS m (user_id, anilist_id, mal_id, status)
        SELECT ${userId}::uuid, entry.anilist_id, entry.mal_id, ${status}::mark_status FROM entry
        ON CONFLICT (user_id, anilist_id) DO UPDATE SET
          mal_id = CASE
            WHEN (SELECT entry.mal_id_sent FROM entry WHERE entry.anilist_id = excluded.anilist_id)
            THEN excluded.mal_id
            ELSE m.mal_id
          END,
          marked_at = CASE WHEN m.status = excluded.status THEN m.marked_at ELSE now() END,
          status = excluded.status
        RETURNING m.anilist_id AS "anilistId", m.mal_id AS "malId",
          m.status::text AS "status", m.marked_at AS "markedAt"`;
      return rows.sort(byAnilistId);
    },

    remove: async (userId, anilistIds) => {
      await prisma.mark.deleteMany({ where: { userId, anilistId: { in: anilistIds } } });
    },
  };
}
