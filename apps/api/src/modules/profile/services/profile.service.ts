import type { Session } from '../../../http/session.js';
import type { ProfileRepository, ProfileView } from '../repositories/profile.repository.js';

export interface ProfileService {
  // The first request after sign-in creates the profile from the Google name and avatar.
  me(session: Session): Promise<ProfileView>;
}

export function createProfileService(profiles: ProfileRepository): ProfileService {
  return {
    me: (session) =>
      profiles.findOrCreate(session.userId, {
        displayName: session.name ?? '',
        avatarUrl: session.image ?? null,
      }),
  };
}
