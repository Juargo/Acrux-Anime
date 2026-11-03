// Client for GET /api/v1/me (#28). The first call after sign-in creates the profile.

export interface Profile {
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  listVisibility: 'private' | 'public';
  counterMode: 'franchise' | 'entry';
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
