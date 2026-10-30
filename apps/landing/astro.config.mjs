import vercel from '@astrojs/vercel';
import { defineConfig, envField } from 'astro/config';

// Validation landing at acruxanime.com (ADR-0012, ADR-0031).
// Spanish lives at the root and English under /en/ (ADR-0010).
// Pages stay static; only /api/waitlist runs as a Vercel function (ADR-0033).
export default defineConfig({
  site: 'https://acruxanime.com',
  adapter: vercel(),
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: false },
  },
  env: {
    schema: {
      BUTTONDOWN_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // PostHog project key (EU cloud). It is public by design; without it analytics stays off.
      PUBLIC_POSTHOG_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
});
