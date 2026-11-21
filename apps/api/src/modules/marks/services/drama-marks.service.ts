import type { Session } from '../../../http/session.js';
import type { ProfileService } from '../../profile/services/profile.service.js';
import type {
  DramaMarkPage,
  DramaMarksRepository,
  DramaMarkView,
} from '../repositories/drama-marks.repository.js';
import type { MarkPageQuery, MarkStatus } from '../repositories/marks.repository.js';

export type { DramaMarkPage, DramaMarkView };

export interface DramaMarksService {
  // One page, ordered by dramaId.
  list(session: Session, page: MarkPageQuery): Promise<DramaMarkPage>;
  // Any user's drama marks, for the export of the account (ADR-0028).
  listOf(userId: string, page: MarkPageQuery): Promise<DramaMarkPage>;
  // null when the drama is not in the catalog.
  put(
    session: Session,
    dramaId: number,
    input: { status: MarkStatus },
  ): Promise<DramaMarkView | null>;
  // Idempotent: removing a mark that does not exist is not an error.
  remove(session: Session, dramaId: number): Promise<void>;
}

export function createDramaMarksService(
  marks: DramaMarksRepository,
  profiles: Pick<ProfileService, 'ensureProfile'>,
): DramaMarksService {
  return {
    list: (session, page) => marks.list(session.userId, page),
    listOf: (userId, page) => marks.list(userId, page),
    put: async (session, dramaId, { status }) => {
      // A mark needs its profile row, created the same way GET /api/v1/me creates it.
      await profiles.ensureProfile(session);
      return marks.upsert(session.userId, dramaId, status);
    },
    remove: (session, dramaId) => marks.remove(session.userId, dramaId),
  };
}
