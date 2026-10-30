import { defineConfig } from 'astro/config';

// Validation landing at acruxanime.com (ADR-0012, ADR-0031).
// Spanish lives at the root and English under /en/ (ADR-0010).
export default defineConfig({
  site: 'https://acruxanime.com',
  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'es',
    routing: { prefixDefaultLocale: false },
  },
});
