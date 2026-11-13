import type { VitePWAOptions } from 'vite-plugin-pwa';

const brand = '#0b0d1c';

/**
 * Installable PWA that caches only the app shell (ADR-0016, #44). The new service worker waits
 * for "Recargar" (registerType prompt), and nothing else fetched at run time is cached: the API,
 * Neon Auth, the cover images and PostHog always go to the network (ADR-0024). The icons come from
 * public/icons/marca.svg (@vite-pwa/assets-generator).
 *
 * The document is not precached: api/html.ts gives it a fresh CSP nonce on every request
 * (ADR-0042), so navigations go to the network first and fall back to the last copy offline.
 * Every route shares one cache entry, since the SPA document is the same for all of them.
 */
export const SHELL_CACHE = 'acrux-shell';
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
    globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
    navigateFallback: null,
    runtimeCaching: [
      {
        // /api answers from the function, never from the shell (the crawler card of /@handle too).
        urlPattern: ({ request, url }) =>
          request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: SHELL_CACHE,
          networkTimeoutSeconds: 5,
          plugins: [{ cacheKeyWillBeUsed: async () => '/' }],
        },
      },
    ],
    cleanupOutdatedCaches: true,
  },
};
