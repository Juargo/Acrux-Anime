import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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

// SPA served as static files on Vercel; /api goes to the Express function (ADR-0020).
// Locally, /api is proxied to the API dev server (pnpm --filter @acrux/api dev).
export default defineConfig({
  plugins: [react(), ...sentry],
  build: { sourcemap: sentry.length > 0 ? 'hidden' : false },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
