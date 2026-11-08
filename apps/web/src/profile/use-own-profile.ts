import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { type Profile, type ProfileChanges, patchMe } from '../profile-api';

const PROFILE_KEY = ['me', 'profile'] as const;

/**
 * The signed-in user's profile, shared by the screens that change it (the privacy of the
 * list, the first card shared): the profile App loaded until a change saves a newer one.
 */
export function useOwnProfile(options: {
  initial: Profile;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
}) {
  const { initial, getToken, fetchFn = fetch } = options;
  const queryClient = useQueryClient();
  const profile =
    useQuery({
      queryKey: PROFILE_KEY,
      queryFn: () => initial,
      initialData: initial,
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: Number.POSITIVE_INFINITY,
    }).data ?? initial;
  const save = useCallback(
    async (changes: ProfileChanges) => {
      const saved = await patchMe(getToken, changes, fetchFn);
      queryClient.setQueryData<Profile>(PROFILE_KEY, saved);
      return saved;
    },
    [getToken, fetchFn, queryClient],
  );
  // Replaces the shared profile with a newer one read from /me, such as after buying Plus.
  const replace = useCallback(
    (next: Profile) => queryClient.setQueryData<Profile>(PROFILE_KEY, next),
    [queryClient],
  );
  return [profile, save, replace] as const;
}
