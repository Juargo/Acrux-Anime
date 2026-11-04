// Client for GET and PATCH /api/v1/me (#28, #34). The first call after sign-in creates the profile.

export interface Profile {
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  listVisibility: 'private' | 'public';
  counterMode: 'franchise' | 'entry';
  // The @handle of the public link (#37).
  handle: string;
  // The last counter the owner saw, shown to visitors and in the preview image (#37).
  shownTotal: number | null;
  shownMode: 'franchise' | 'entry' | null;
  // Whether a card was ever shared (#36).
  cardShared: boolean;
}

export interface ProfileChanges {
  counterMode?: Profile['counterMode'];
  listVisibility?: Profile['listVisibility'];
  shown?: { total: number; mode: Profile['counterMode'] };
  cardShared?: true;
}

export type MeResult =
  | { status: 'ok'; profile: Profile }
  | { status: 'signed-out' }
  | { status: 'error'; requestId: string | undefined };

export async function fetchMe(
  getToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<MeResult> {
  const token = await getToken();
  if (!token) return { status: 'signed-out' };
  const response = await fetchFn('/api/v1/me', { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401) return { status: 'signed-out' };
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as { requestId?: string };
    return { status: 'error', requestId: problem.requestId };
  }
  return { status: 'ok', profile: (await response.json()) as Profile };
}

// PATCH /api/v1/me with any of its changes; returns the profile after them.
export async function patchMe(
  getToken: () => Promise<string | null>,
  changes: ProfileChanges,
  fetchFn: typeof fetch = fetch,
): Promise<Profile> {
  const token = await getToken();
  if (!token) throw new Error('Signed out');
  const response = await fetchFn('/api/v1/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw new Error(`Saving the profile failed with ${response.status}`);
  return (await response.json()) as Profile;
}

// Saves how the total counter counts (RF-25).
export function saveCounterMode(
  getToken: () => Promise<string | null>,
  counterMode: Profile['counterMode'],
  fetchFn: typeof fetch = fetch,
): Promise<Profile> {
  return patchMe(getToken, { counterMode }, fetchFn);
}
