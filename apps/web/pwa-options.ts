import type { VitePWAOptions } from 'vite-plugin-pwa';

const brand = '#0b0d1c';

/**
 * Installable PWA that caches only the app shell (ADR-0016, #44). The new service worker waits
 * for "Recargar" (registerType prompt), and nothing fetched at run time is cached: the API, Neon
 * Auth, the cover images and PostHog always go to the network (ADR-0024). The icons come from
 * public/icons/marca.svg (@vite-pwa/assets-generator).
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
  // UpdatePrompt registers it through virtual:pwa-register/react.
  injectRegister: false,
  manifest: {
    name: 'Acrux',
    short_name: 'Acrux',
    description:
      'Marca la saga, no las temporadas, y compártelo en segundos. Gratis, en español y sin anuncios en tu tarjeta.',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: brand,
    background_color: brand,
    icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{html,js,css,svg,png,ico,woff2}'],
    // /api answers from the function, never from the shell (the crawler card of /@handle too).
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
  },
};
