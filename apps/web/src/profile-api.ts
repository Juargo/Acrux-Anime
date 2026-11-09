// Client for GET and PATCH /api/v1/me (#28, #34). The first call after sign-in creates the profile.

import type { Locale } from '@acrux/i18n';
import { apiError } from './api-errors';

export type AvatarPreset = 'violeta' | 'verde' | 'amarillo' | 'coral' | 'noche' | 'lavanda';

// Card themes (RF-52): Clásica is free and Neón needs Plus.
export type CardTheme = 'clasica' | 'neon';

export interface Profile {
  displayName: string;
  avatarUrl: string | null;
  // A preset Acrux avatar (#39), shown instead of avatarUrl; null shows Google's.
  avatarPreset: AvatarPreset | null;
  // The language the user chose (#43); null follows the device language.
  locale: Locale | null;
  listVisibility: 'private' | 'public';
  counterMode: 'franchise' | 'entry';
  // The @handle of the public link (#37).
  handle: string;
  // The last counter the owner saw, shown to visitors and in the preview image (#37).
  shownTotal: number | null;
  shownMode: 'franchise' | 'entry' | null;
  // Whether a card was ever shared (#36).
  cardShared: boolean;
  // The card theme (RF-52); the API sends clasica to anyone without Plus.
  cardTheme?: CardTheme;
  // When the profile was created, and the salted id analytics knows the user by (#46).
  createdAt: string;
  analyticsId: string | null;
  // The session has the curator role (#42). Only shows the curator screen; the API checks.
  curator?: boolean;
  // The plan read from the database (epic #50). Only shows; the API checks every Plus route.
  plan?: 'free' | 'plus';
  // Whether Plus can be bought here; false while billing is off (ADR-0036).
  plusAvailable?: boolean;
}

export interface ProfileChanges {
  displayName?: string;
  avatarPreset?: AvatarPreset | null;
  counterMode?: Profile['counterMode'];
  listVisibility?: Profile['listVisibility'];
  shown?: { total: number; mode: Profile['counterMode'] };
  cardShared?: true;
  locale?: Locale | null;
  cardTheme?: CardTheme;
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
  if (!response.ok)
    throw await apiError(response, `Saving the profile failed with ${response.status}`);
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
