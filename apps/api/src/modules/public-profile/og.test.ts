import { afterEach, describe, expect, it, vi } from 'vitest';
import { avatarImage } from './og.js';

afterEach(() => vi.unstubAllGlobals());

describe('avatarImage', () => {
  it('draws a preset avatar without fetching the Google one (#39)', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const src = await avatarImage({
      avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
      avatarPreset: 'verde',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(src).toMatch(/^data:image\/svg\+xml;base64,/);
    const svg = Buffer.from(src?.split(',')[1] ?? '', 'base64').toString();
    expect(svg).toContain('#4fd1a5');
  });

  it('uses the Google avatar when there is no preset', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
    );
    vi.stubGlobal('fetch', fetch);
    const src = await avatarImage({
      avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
      avatarPreset: null,
    });
    expect(src).toBe('data:image/png;base64,AQID');
  });

  it('has no avatar image without a preset or a Google avatar', async () => {
    expect(await avatarImage({ avatarUrl: null, avatarPreset: null })).toBeNull();
  });
});
