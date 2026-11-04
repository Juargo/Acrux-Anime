import { readFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import type { PublicProfileView } from './public-profile.service.js';

// The engine of @vercel/og (satori, then resvg), used directly: @vercel/og 1.0 cannot load in
// plain Node ESM. Outfit, the display font of the app (SIL OFL, assets/fonts).
// Literal URLs, so Vercel's file tracing ships both fonts with the function.
const FONT_600 = new URL('../../../assets/fonts/outfit-latin-600-normal.woff', import.meta.url);
const FONT_700 = new URL('../../../assets/fonts/outfit-latin-700-normal.woff', import.meta.url);
let fonts:
  | Promise<{ name: string; data: Buffer; weight: 600 | 700; style: 'normal' }[]>
  | undefined;
const loadFonts = () => {
  fonts ??= Promise.all([
    readFile(FONT_600).then((data) => ({
      name: 'Outfit',
      data,
      weight: 600 as const,
      style: 'normal' as const,
    })),
    readFile(FONT_700).then((data) => ({
      name: 'Outfit',
      data,
      weight: 700 as const,
      style: 'normal' as const,
    })),
  ]);
  return fonts;
};

// Social networks expect 1200 × 630 (RNF-52).
export const OG_SIZE = { width: 1200, height: 630 };

// Figma tokens of the card (apps/web/src/styles.css).
const COLOR = {
  canvas: '#0b0d1c',
  surface: '#12152b',
  accent: '#9d8cf5',
  link: '#c3b8ff',
  text: '#f5f6ff',
  secondary: '#b4b8d6',
  onAccent: '#0b0d1c',
};

// "48 animes completos" by franchises, "130 entradas vistas" by entries (the owner's mode).
export function totalText(summary: Pick<PublicProfileView, 'shownTotal' | 'shownMode'>) {
  if (summary.shownTotal === null) return null;
  const label = summary.shownMode === 'entry' ? 'entradas vistas' : 'animes completos';
  return { count: String(summary.shownTotal), label };
}

// Only Google avatars are drawn, the same hosts the CSP allows for images; anything else
// (an avatar from a later upload, #39) falls back to the initial and is never fetched.
const isGoogleAvatar = (url: string | null): url is string =>
  url !== null && /^https:\/\/lh\d\.googleusercontent\.com\//.test(url);

// The avatar as a data URL, or null: a slow or failed avatar never fails the image.
async function avatarData(url: string | null): Promise<string | null> {
  if (!isGoogleAvatar(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: 'error' });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !/^image\/(png|jpeg|webp)$/.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 512 * 1024) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

type Node = { type: string; props: Record<string, unknown> };
const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
  extra = {},
): Node => ({
  type,
  props: { style, children, ...extra },
});

// Name, avatar and total only (S3 of odd/tasks/perfil-publico.md): never the lists.
export async function profileImage(summary: PublicProfileView): Promise<Buffer> {
  const name = summary.displayName.trim() || 'Sin nombre';
  const initial = name.charAt(0).toUpperCase();
  const total = totalText(summary);
  const avatarUrl = await avatarData(summary.avatarUrl);
  const avatar = avatarUrl
    ? el('img', { width: 160, height: 160, borderRadius: 80 }, undefined, {
        src: avatarUrl,
        width: 160,
        height: 160,
      })
    : el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 160,
          height: 160,
          borderRadius: 80,
          background: COLOR.accent,
          color: COLOR.onAccent,
          fontSize: 72,
          fontWeight: 600,
        },
        initial,
      );
  const tree = el(
    'div',
    {
      display: 'flex',
      width: OG_SIZE.width,
      height: OG_SIZE.height,
      padding: '72px 96px',
      boxSizing: 'border-box',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: COLOR.canvas,
      backgroundImage:
        'linear-gradient(180deg, rgba(157,140,245,0.30) 0%, rgba(157,140,245,0) 70%)',
      color: COLOR.text,
      fontFamily: 'Outfit',
    },
    [
      el('div', { display: 'flex', flexDirection: 'column', gap: 24, flexShrink: 1, minWidth: 0 }, [
        avatar,
        el('div', { display: 'flex', fontSize: 64, fontWeight: 600 }, name.slice(0, 30)),
        el('div', { display: 'flex', fontSize: 36, color: COLOR.secondary }, `@${summary.handle}`),
      ]),
      el(
        'div',
        { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 },
        total
          ? [
              el(
                'div',
                {
                  display: 'flex',
                  fontSize: 180,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: COLOR.link,
                },
                total.count,
              ),
              el(
                'div',
                {
                  display: 'flex',
                  marginTop: 12,
                  fontSize: 28,
                  fontWeight: 600,
                  color: COLOR.secondary,
                  letterSpacing: 1,
                },
                total.label.toUpperCase(),
              ),
              el(
                'div',
                { display: 'flex', marginTop: 48, fontSize: 32, color: COLOR.accent },
                'Acrux',
              ),
            ]
          : [el('div', { display: 'flex', fontSize: 64, color: COLOR.accent }, 'Acrux')],
      ),
    ],
  );
  // satori takes a React element; it reads the same plain {type, props} shape.
  const svg = await satori(tree as never, { ...OG_SIZE, fonts: await loadFonts() });
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: OG_SIZE.width } }).render().asPng(),
  );
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );

// The page a crawler gets for /@handle (vercel.json sends only crawlers here): the Open Graph
// tags and a link to the profile for anyone who lands on it.
export function sharePage(summary: PublicProfileView, origin: string): string {
  const name = summary.displayName.trim() || 'Sin nombre';
  const url = `${origin}/@${summary.handle}`;
  const total = totalText(summary);
  const title = escapeHtml(`${name} (@${summary.handle}) en Acrux`);
  const description = escapeHtml(
    total
      ? `${total.count} ${total.label}. ¿Y tú, cuántos has visto?`
      : '¿Y tú, cuántos has visto?',
  );
  const image = `${origin}/api/v1/profiles/${summary.handle}/og.png`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="Acrux">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="${OG_SIZE.width}">
<meta property="og:image:height" content="${OG_SIZE.height}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${url}">
</head>
<body><a href="${url}">${title}</a></body>
</html>
`;
}

export const notFoundPage = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Perfil no disponible · Acrux</title></head>
<body><p>Perfil no disponible</p></body>
</html>
`;
