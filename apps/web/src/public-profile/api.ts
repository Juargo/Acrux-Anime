// Client for the public profile (#37): no session, nothing but what the owner made visible.
import { readProblem } from '../api-errors';
import type { MarkDto } from '../marks-api';

export interface PublicProfile {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: import('../profile-api').AvatarPreset | null;
  listVisibility: 'private' | 'public';
  // The owner's last counter (L3 of odd/tasks/perfil-publico.md), null until they open the app.
  shownTotal: number | null;
  shownMode: 'franchise' | 'entry' | null;
  // Badge ids; the API returns them only while the owner is Plus (RF-55).
  badges?: string[];
}

// `code` is the API problem's (ADR-0023), when the API answered with one.
export class PublicProfileError extends Error {
  constructor(readonly code?: string) {
    super('Public profile request failed');
    this.name = 'PublicProfileError';
  }
}

// The same rule as the API: anything else is not looked up at all.
export const isHandle = (value: string) => /^[a-z0-9_]{3,20}$/.test(value);

const PAGE_SIZE = 1000;

// null on 404: an unknown handle, or a private list for the marks.
async function get(path: string, fetchFn: typeof fetch): Promise<unknown | null> {
  let response: Response;
  try {
    response = await fetchFn(path, {});
  } catch {
    throw new PublicProfileError();
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new PublicProfileError((await readProblem(response)).code);
  return response.json();
}

export async function fetchPublicProfile(
  handle: string,
  fetchFn: typeof fetch = fetch,
): Promise<PublicProfile | null> {
  if (!isHandle(handle)) return null;
  return (await get(`/api/v1/profiles/${handle}`, fetchFn)) as PublicProfile | null;
}

// Every page of a public list, or null while it is private (RF-42).
export async function fetchPublicMarks(
  handle: string,
  fetchFn: typeof fetch = fetch,
): Promise<MarkDto[] | null> {
  if (!isHandle(handle)) return null;
  const marks: MarkDto[] = [];
  let cursor: string | null = null;
  do {
    const path: string = `/api/v1/profiles/${handle}/marks?limit=${PAGE_SIZE}${cursor ? `&cursor=${cursor}` : ''}`;
    const body = (await get(path, fetchFn)) as {
      items: MarkDto[];
      nextCursor: string | null;
    } | null;
    if (!body) return null;
    marks.push(...body.items);
    // The cursor only moves forward (animeId order); anything else would page forever.
    if (body.nextCursor !== null && Number(body.nextCursor) <= Number(cursor ?? 0)) {
      throw new PublicProfileError();
    }
    cursor = body.nextCursor;
  } while (cursor);
  return marks;
}
