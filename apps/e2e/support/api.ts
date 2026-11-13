// Calls to the E2E API with a test user's token, to set up the state a journey starts from.
import type { APIRequestContext } from '@playwright/test';
import { API_URL } from './env.ts';
import type { TestUser } from './neon-auth.ts';

const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

async function ok<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.url()} answered ${response.status()}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

// GET /api/v1/me creates the profile on the first call, as the app does after sign-in.
export async function profileOf(request: APIRequestContext, user: TestUser) {
  return ok<{ handle: string; listVisibility: 'private' | 'public' }>(
    await request.get(`${API_URL}/api/v1/me`, { headers: auth(user) }),
  );
}

export async function markSeen(request: APIRequestContext, user: TestUser, animeIds: number[]) {
  await ok(
    await request.post(`${API_URL}/api/v1/me/marks:batch`, {
      headers: auth(user),
      data: { status: 'seen', entries: animeIds.map((animeId) => ({ animeId })) },
    }),
  );
}

export async function makeListPublic(request: APIRequestContext, user: TestUser) {
  await ok(
    await request.patch(`${API_URL}/api/v1/me`, {
      headers: auth(user),
      data: { listVisibility: 'public' },
    }),
  );
}
