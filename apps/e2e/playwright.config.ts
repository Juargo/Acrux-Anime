import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { API_URL, FAKE_AUTH_URL, WEB_PORT, WEB_URL } from './support/env.ts';

// E2E against the app built locally (ADR-0037): `pnpm --filter @acrux/e2e build:apps` first,
// and DATABASE_URL pointing to a disposable Postgres with the migrations applied.
const ci = Boolean(process.env.CI);
const webDir = fileURLToPath(new URL('../web', import.meta.url));

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    // The app starts in the browser language; the criteria are in Spanish.
    locale: 'es-CL',
    trace: 'on-first-retry',
    // The PWA service worker would fetch outside page.route().
    serviceWorkers: 'block',
  },
  // Phone viewport, Chromium and WebKit (ADR-0029).
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 14'] } },
  ],
  webServer: [
    {
      command: 'node support/fake-neon-auth.ts',
      url: `${FAKE_AUTH_URL}/health`,
      reuseExistingServer: !ci,
      stdout: 'pipe',
    },
    {
      command: 'node support/start-api.ts',
      url: `${API_URL}/api/health`,
      reuseExistingServer: !ci,
      stdout: 'pipe',
    },
    {
      // vite preview proxies /api to the API, as the dev server does.
      command: `pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
      cwd: webDir,
      url: WEB_URL,
      reuseExistingServer: !ci,
    },
  ],
});
