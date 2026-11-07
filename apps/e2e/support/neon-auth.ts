// The Neon Auth calls of the browser, answered by Playwright (ADR-0037). The web built for
// E2E talks to BROWSER_NEON_AUTH_URL (same origin), and @neon/auth reads the session from
// GET /get-session, with the JWT in the `set-auth-jwt` header. The JWT comes from the fake
// server, signed with the key the API trusts.
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Route } from '@playwright/test';
import { BROWSER_NEON_AUTH_PATH, FAKE_AUTH_URL } from './env.ts';

export interface TestUser {
  id: string;
  name: string;
  token: string;
}

// `role` as Neon Auth signs it, e.g. "curator" after `neon neon-auth user set-role` (#42).
export async function createUser(name: string, options: { role?: string } = {}): Promise<TestUser> {
  const id = randomUUID();
  const response = await fetch(`${FAKE_AUTH_URL}/test/tokens`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sub: id, name, ...options }),
  });
  if (!response.ok) throw new Error(`The fake Neon Auth answered ${response.status}`);
  const { token } = (await response.json()) as { token: string };
  return { id, name, token };
}

// Whether the fake Neon API received the deletion of this auth user.
export async function authUserDeleted(userId: string): Promise<boolean> {
  const response = await fetch(`${FAKE_AUTH_URL}/test/deleted-users/${userId}`);
  return ((await response.json()) as { deleted: boolean }).deleted;
}

// Better Auth's session shape: { session, user }, or null when signed out.
function sessionBody(user: TestUser, startedAt: Date) {
  const created = startedAt.toISOString();
  const expires = new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    session: {
      id: `session-${user.id}`,
      userId: user.id,
      token: user.token,
      expiresAt: expires,
      createdAt: created,
      updatedAt: created,
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: user.id,
      name: user.name,
      email: `${user.id}@e2e.invalid`,
      emailVerified: true,
      image: null,
      createdAt: created,
      updatedAt: created,
    },
  };
}

/**
 * Installs the Neon Auth routes on a context. With a user, the session is alive until the app
 * signs out; without one, the visitor has no session. `startedAt` is the session start the
 * app checks before deleting the account (RF-06).
 */
export async function installNeonAuth(
  context: BrowserContext,
  user: TestUser | null,
  startedAt: Date = new Date(),
) {
  let signedIn = user !== null;
  await context.route(`**${BROWSER_NEON_AUTH_PATH}/**`, async (route: Route) => {
    const path = new URL(route.request().url()).pathname.slice(BROWSER_NEON_AUTH_PATH.length);
    if (path === '/get-session') {
      if (!signedIn || !user) return route.fulfill({ json: null });
      return route.fulfill({
        json: sessionBody(user, startedAt),
        headers: { 'set-auth-jwt': user.token },
      });
    }
    if (path === '/sign-out') {
      signedIn = false;
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ status: 404, json: { message: `Not faked: ${path}` } });
  });
}
