import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { MarkPageQuery, MarkStatus } from './marks.repository.js';

// A mark covers the whole show: dramas are stored one row per series (ADR-0046).
export interface DramaMarkView {
  dramaId: number;
  status: MarkStatus;
  markedAt: Date;
}

export interface DramaMarkPage {
  items: DramaMarkView[];
  // The dramaId to continue after, or null on the last page.
  nextCursor: number | null;
}

// Like the anime marks, every query takes the user id from the session and filters by it
// (ADR-0028). Its own table: the anime marks are never read or written here.
export interface DramaMarksRepository {
  // Ordered by dramaId.
  list(userId: string, page: MarkPageQuery): Promise<DramaMarkPage>;
  // The same status keeps markedAt; a new status sets it to now(). The profile must exist.
  // null when the drama is not in the catalog: nothing is written then.
  upsert(userId: string, dramaId: number, status: MarkStatus): Promise<DramaMarkView | null>;
  remove(userId: string, dramaId: number): Promise<void>;
}

export function createDramaMarksRepository(prisma: PrismaClient): DramaMarksRepository {
  return {
    list: async (userId, { after, limit }) => {
      // One row more than the page tells whether another page follows.
      const rows = await prisma.dramaMark.findMany({
        where: { userId, ...(after === undefined ? {} : { dramaId: { gt: after } }) },
        orderBy: { dramaId: 'asc' },
        take: limit + 1,
        select: { dramaId: true, status: true, markedAt: true },
      });
      const items = rows.slice(0, limit);
      return {
        items,
        nextCursor: rows.length > limit ? (items.at(-1)?.dramaId ?? null) : null,
      };
    },

    upsert: async (userId, dramaId, status) => {
      // Selecting from drama writes no row for an unknown id, instead of failing on the
      // foreign key.
      const rows = await prisma.$queryRaw<DramaMarkView[]>`
        INSERT INTO drama_mark AS m (user_id, drama_id, status)
        SELECT ${userId}::uuid, d.id, ${status}::mark_status
        FROM drama AS d
        WHERE d.id = ${dramaId}::int
        ON CONFLICT (user_id, drama_id) DO UPDATE SET
          marked_at = CASE WHEN m.status = excluded.status THEN m.marked_at ELSE now() END,
          status = excluded.status
        RETURNING m.drama_id AS "dramaId", m.status::text AS "status", m.marked_at AS "markedAt"`;
      return rows[0] ?? null;
    },

    remove: async (userId, dramaId) => {
      await prisma.dramaMark.deleteMany({ where: { userId, dramaId } });
    },
  };
}
