/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_VERCEL_ENV?: string;
  readonly VITE_NEON_AUTH_URL?: string;
  // PostHog project key (#46); without it the consent banner never shows and nothing loads.
  readonly VITE_POSTHOG_KEY?: string;
  // AdSense (RF-58): without both, no ads load and the banner asks only for analytics.
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT?: string;
}

// Defined in vite.config.ts (#45).
declare const __APP_VERSION__: string;
