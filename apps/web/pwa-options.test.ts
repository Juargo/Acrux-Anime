import { describe, expect, it } from 'vitest';
import { pwaOptions } from './pwa-options';

const denied = (path: string) =>
  (pwaOptions.workbox?.navigateFallbackDenylist ?? []).some((pattern) => pattern.test(path));

describe('pwaOptions (ADR-0016)', () => {
  it('waits for the user before activating a new version', () => {
    expect(pwaOptions.registerType).toBe('prompt');
  });

  it('is installable: standalone, brand colors and icons, a maskable one included', () => {
    const manifest = pwaOptions.manifest || {};
    expect(manifest).toMatchObject({
      name: 'Acrux',
      short_name: 'Acrux',
      lang: 'es',
      start_url: '/',
      display: 'standalone',
      theme_color: '#0b0d1c',
      background_color: '#0b0d1c',
    });
    const sizes = manifest.icons?.map((icon) => `${icon.sizes} ${icon.purpose ?? 'any'}`);
    expect(sizes).toEqual(['64x64 any', '192x192 any', '512x512 any', '512x512 maskable']);
  });

  it('caches only the app shell: no runtime caching of the API or the covers', () => {
    expect(pwaOptions.workbox?.runtimeCaching).toBeUndefined();
    expect(pwaOptions.workbox?.globPatterns).toEqual(['**/*.{html,js,css,svg,png,ico,woff2}']);
    expect(denied('/api/v1/me')).toBe(true);
    expect(denied('/perfil')).toBe(false);
    expect(denied('/@camila')).toBe(false);
  });
});
