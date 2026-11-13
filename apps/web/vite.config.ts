/// <reference types="vitest/config" />
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { NONCE_PLACEHOLDER } from './api/_csp';
import { version } from './package.json';
import { pwaOptions } from './pwa-options';

// The deploy job sets these: maps go to Sentry and never to the published files.
const { SENTRY_AUTH_TOKEN: authToken, SENTRY_ORG: org, SENTRY_PROJECT: project } = process.env;
const sentry =
  authToken && org && project
    ? [
        sentryVitePlugin({
          authToken,
          org,
          project,
          telemetry: false,
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        }),
      ]
    : [];

// "Acerca de" shows it (#45). Vercel and GitHub Actions expose the commit at build time.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '').slice(0, 7);
const appVersion = commit ? `${version} (${commit})` : `${version} (local)`;

// SPA served as static files on Vercel; /api goes to the Express function (ADR-0020).
// Locally, /api is proxied to the API dev server (pnpm --filter @acrux/api dev).
export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions), ...sentry],
  // api/html.ts swaps the placeholder for a fresh nonce on every request (ADR-0042).
  html: { cspNonce: NONCE_PLACEHOLDER },
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  build: { sourcemap: sentry.length > 0 ? 'hidden' : false },
  test: { setupFiles: ['./src/test-setup.ts'] },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
