// Starts the built API (apps/api/dist) for E2E (ADR-0037). The environment is built here, so
// a developer's own variables (Sentry, Upstash, PostHog, real Neon) never leak in. Run with
// `node` after `pnpm --filter @acrux/e2e build:apps`.
import { API_PORT, FAKE_NEON_API_URL, FAKE_NEON_AUTH_BASE_URL } from './env.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Set DATABASE_URL to a disposable Postgres with the migrations applied.');
}

for (const name of [
  'NEON_AUTH_ISSUER',
  'SENTRY_DSN',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ANALYTICS_ID_SECRET',
  'POSTHOG_PERSONAL_API_KEY',
  'POSTHOG_PROJECT_ID',
  'POSTHOG_API_HOST',
  'VERCEL_GIT_COMMIT_SHA',
]) {
  delete process.env[name];
}
Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  NEON_AUTH_BASE_URL: FAKE_NEON_AUTH_BASE_URL,
  // Placeholders: account deletion only runs with all three set. The calls go to the fake.
  NEON_API_KEY: 'e2e',
  NEON_PROJECT_ID: 'e2e',
  NEON_BRANCH_ID: 'e2e',
  VERCEL_ENV: 'e2e',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
});

// The Neon API base is fixed in the adapter, so its calls are sent to the fake server here,
// before the API builds its container. Every other request goes out unchanged.
const NEON_API = 'https://console.neon.tech/api/v2/';
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith(NEON_API)) {
    return realFetch(`${FAKE_NEON_API_URL}${url.slice(NEON_API.length)}`, init);
  }
  return realFetch(input, init);
};

const appModule = new URL('../../api/dist/app.js', import.meta.url).href;
const { default: app } = (await import(appModule)) as {
  default: { listen: (port: number, callback: () => void) => void };
};
app.listen(API_PORT, () => {
  console.log(`E2E API listening on http://localhost:${API_PORT}/api/health`);
});
