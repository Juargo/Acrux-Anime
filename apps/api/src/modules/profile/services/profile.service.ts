import type { Session } from '../../../http/session.js';
import { analyticsId } from '../domain/analytics-id.js';
import type {
  ProfileChanges,
  ProfileRepository,
  ProfileView,
  PublicProfileRow,
} from '../repositories/profile.repository.js';

export type { PublicProfileRow };

// The profile of the signed-in user, with the id analytics knows them by (null without the
// secret, so the app captures anonymously).
export type MeView = ProfileView & { analyticsId: string | null };

export interface ProfileService {
  // The first request after sign-in creates the profile from the Google name and avatar.
  me(session: Session): Promise<MeView>;
  // Same find-or-create as `me`, for modules whose rows reference the profile.
  ensureProfile(session: Session): Promise<void>;
  // PATCH /api/v1/me: counter mode, list visibility, shown counter and first card shared.
  update(session: Session, changes: ProfileChanges): Promise<MeView>;
  // The profile of a handle, for the public profile (#37), which decides what visitors see.
  findByHandle(handle: string): Promise<PublicProfileRow | null>;
  // Deletes the profile and every row that references it (#38); false when there was none.
  remove(userId: string): Promise<boolean>;
}

export function createProfileService(
  profiles: ProfileRepository,
  options: { analyticsSecret?: string | undefined } = {},
): ProfileService {
  const initial = (session: Session) => ({
    displayName: session.name ?? '',
    avatarUrl: session.image ?? null,
  });
  const withAnalytics = (session: Session, view: ProfileView): MeView => ({
    ...view,
    analyticsId: options.analyticsSecret
      ? analyticsId(session.userId, options.analyticsSecret)
      : null,
  });
  return {
    me: async (session) =>
      withAnalytics(session, await profiles.findOrCreate(session.userId, initial(session))),
    ensureProfile: async (session) => {
      await profiles.findOrCreate(session.userId, initial(session));
    },
    update: async (session, changes) =>
      withAnalytics(session, await profiles.update(session.userId, initial(session), changes)),
    findByHandle: (handle) => profiles.findByHandle(handle),
    remove: (userId) => profiles.remove(userId),
  };
}
