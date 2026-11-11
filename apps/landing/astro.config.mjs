import vercel from '@astrojs/vercel';
import { defineConfig, envField } from 'astro/config';

// Landing at acruxanime.com (ADR-0012, ADR-0044).
// Spanish lives at the root and English under /en/ (ADR-0010).
// Every page is static: the waitlist endpoint is gone since the direct launch (ADR-0044).
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
      // PostHog project key (EU cloud). It is public by design; without it analytics stays off.
      PUBLIC_POSTHOG_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },
});
