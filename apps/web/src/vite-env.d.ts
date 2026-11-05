/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_VERCEL_ENV?: string;
  readonly VITE_NEON_AUTH_URL?: string;
  // PostHog project key (#46); without it the consent banner never shows and nothing loads.
  readonly VITE_POSTHOG_KEY?: string;
}
