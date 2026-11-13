import { describe, expect, it } from 'vitest';
import { pwaOptions, SHELL_CACHE } from './pwa-options';

const [shell, ...others] = pwaOptions.workbox?.runtimeCaching ?? [];
const matchShell = shell?.urlPattern as (context: { request: Request; url: URL }) => boolean;
const navigation = (path: string) =>
  matchShell({
    request: { mode: 'navigate' } as Request,
    url: new URL(path, 'https://app.acruxanime.com'),
  });

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
    expect(others).toEqual([]);
    expect(pwaOptions.workbox?.globPatterns).toEqual(['**/*.{js,css,svg,png,ico,woff2}']);
    expect(navigation('/api/v1/me')).toBe(false);
    expect(
      matchShell({
        request: { mode: 'no-cors' } as Request,
        url: new URL('https://cdn.myanimelist.net/images/anime/1208/94745l.jpg'),
      }),
    ).toBe(false);
  });

  // ADR-0042: the document carries a per-request CSP nonce, so it is never precached.
  it('asks the network for every navigation and keeps one copy for offline use', () => {
    expect(pwaOptions.workbox?.navigateFallback).toBeNull();
    expect(navigation('/perfil')).toBe(true);
    expect(navigation('/@camila')).toBe(true);
    expect(shell?.handler).toBe('NetworkFirst');
    expect(shell?.options?.cacheName).toBe(SHELL_CACHE);
  });

  it('serves the same offline copy for every route', async () => {
    const [plugin] = shell?.options?.plugins ?? [];
    const key = (path: string) =>
      plugin?.cacheKeyWillBeUsed?.({
        request: new Request(`https://app.acruxanime.com${path}`),
        mode: 'read',
      } as never);
    expect(await key('/perfil')).toBe('/');
    expect(await key('/franquicia/21')).toBe('/');
  });
});
