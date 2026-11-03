import type { Session } from '../../../http/session.js';
import type { ProfileRepository, ProfileView } from '../repositories/profile.repository.js';

export interface ProfileService {
  // The first request after sign-in creates the profile from the Google name and avatar.
  me(session: Session): Promise<ProfileView>;
  // Same find-or-create as `me`, for modules whose rows reference the profile.
  ensureProfile(session: Session): Promise<void>;
}

export function createProfileService(profiles: ProfileRepository): ProfileService {
  const me = (session: Session) =>
    profiles.findOrCreate(session.userId, {
      displayName: session.name ?? '',
      avatarUrl: session.image ?? null,
    });
  return {
    me,
    ensureProfile: async (session) => {
      await me(session);
    },
  };
}
