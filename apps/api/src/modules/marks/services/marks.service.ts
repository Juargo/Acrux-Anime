import type { Session } from '../../../http/session.js';
import type { ProfileService } from '../../profile/services/profile.service.js';
import type {
  MarkEntry,
  MarkPage,
  MarkPageQuery,
  MarkStatus,
  MarksRepository,
  MarkView,
} from '../repositories/marks.repository.js';

export type { MarkEntry, MarkPage, MarkPageQuery, MarkStatus, MarkView };

export interface MarksService {
  // One page, ordered by animeId.
  list(session: Session, page: MarkPageQuery): Promise<MarkPage>;
  // Any user's marks, for the public profile (#37), which checks first that the list is public.
  listOf(userId: string, page: MarkPageQuery): Promise<MarkPage>;
  put(session: Session, animeId: number, input: { status: MarkStatus }): Promise<MarkView>;
  // Idempotent: removing a mark that does not exist is not an error.
  remove(session: Session, animeId: number): Promise<void>;
  // All entries in one transaction (RDI-31); a null status removes them and returns [].
  batch(
    session: Session,
    input: { status: MarkStatus | null; entries: MarkEntry[] },
  ): Promise<MarkView[]>;
}

export function createMarksService(
  marks: MarksRepository,
  profiles: Pick<ProfileService, 'ensureProfile'>,
): MarksService {
  // A mark needs its profile row, created the same way GET /api/v1/me creates it.
  const write = async (session: Session, status: MarkStatus, entries: MarkEntry[]) => {
    await profiles.ensureProfile(session);
    return marks.upsert(
      session.userId,
      status,
      entries.map((entry) => entry.animeId),
    );
  };
  return {
    list: (session, page) => marks.list(session.userId, page),
    listOf: (userId, page) => marks.list(userId, page),
    put: async (session, animeId, { status }) => {
      const [mark] = await write(session, status, [{ animeId }]);
      if (!mark) throw new Error('mark upsert returned no row');
      return mark;
    },
    remove: (session, animeId) => marks.remove(session.userId, [animeId]),
    batch: async (session, { status, entries }) => {
      if (status === null) {
        await marks.remove(
          session.userId,
          entries.map((entry) => entry.animeId),
        );
        return [];
      }
      return write(session, status, entries);
    },
  };
}
