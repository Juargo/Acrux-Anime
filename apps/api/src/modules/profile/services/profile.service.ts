import type { Session } from '../../../http/session.js';
import type {
  ProfileChanges,
  ProfileRepository,
  ProfileView,
  PublicProfileRow,
} from '../repositories/profile.repository.js';

export type { PublicProfileRow };

export interface ProfileService {
  // The first request after sign-in creates the profile from the Google name and avatar.
  me(session: Session): Promise<ProfileView>;
  // Same find-or-create as `me`, for modules whose rows reference the profile.
  ensureProfile(session: Session): Promise<void>;
  // PATCH /api/v1/me: counter mode, list visibility, shown counter and first card shared.
  update(session: Session, changes: ProfileChanges): Promise<ProfileView>;
  // The profile of a handle, for the public profile (#37), which decides what visitors see.
  findByHandle(handle: string): Promise<PublicProfileRow | null>;
}

export function createProfileService(profiles: ProfileRepository): ProfileService {
  const initial = (session: Session) => ({
    displayName: session.name ?? '',
    avatarUrl: session.image ?? null,
  });
  const me = (session: Session) => profiles.findOrCreate(session.userId, initial(session));
  return {
    me,
    ensureProfile: async (session) => {
      await me(session);
    },
    update: (session, changes) => profiles.update(session.userId, initial(session), changes),
    findByHandle: (handle) => profiles.findByHandle(handle),
  };
}
