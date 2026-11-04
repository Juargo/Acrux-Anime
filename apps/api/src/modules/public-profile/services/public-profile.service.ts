import type { MarkPage, MarkPageQuery, MarksService } from '../../marks/services/marks.service.js';
import { isHandle } from '../../profile/domain/handle.js';
import type { ProfileService } from '../../profile/services/profile.service.js';

// What any visitor sees of a profile (RF-40, Figma M14/M15): never the owner's id or email.
export interface PublicProfileView {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  listVisibility: 'private' | 'public';
  shownTotal: number | null;
  shownMode: 'franchise' | 'entry' | null;
}

export interface PublicProfileService {
  // The summary of a handle, private or public; null when no profile has it.
  summary(handle: string): Promise<PublicProfileView | null>;
  // The marks of a public list; null when the handle is unknown or the list is private (RF-42).
  marks(handle: string, page: MarkPageQuery): Promise<MarkPage | null>;
}

export function createPublicProfileService(
  profiles: Pick<ProfileService, 'findByHandle'>,
  marks: Pick<MarksService, 'listOf'>,
): PublicProfileService {
  // An invalid handle is looked up as nothing, so it answers like an unknown one.
  const find = (handle: string) => (isHandle(handle) ? profiles.findByHandle(handle) : null);
  return {
    summary: async (handle) => {
      const row = await find(handle);
      if (!row) return null;
      const { userId: _owner, ...summary } = row;
      return summary;
    },
    marks: async (handle, page) => {
      const row = await find(handle);
      // Read on every request, so making the list private hides it at once (RF-42).
      if (row?.listVisibility !== 'public') return null;
      return marks.listOf(row.userId, page);
    },
  };
}
