import { randomBytes } from 'node:crypto';

/**
 * Content-Security-Policy of the SPA document (ADR-0042). The HTML is served by api/html.ts with
 * a fresh nonce per request, because AdSense supports only a nonce-based strict CSP
 * (https://support.google.com/adsense/answer/16283098). vite.config.ts writes this placeholder
 * on every script, stylesheet and modulepreload tag (html.cspNonce).
 */
export const NONCE_PLACEHOLDER = 'ACRUX_CSP_NONCE';

type Env = Record<string, string | undefined>;

// Same switch as src/main.tsx: ads run only when both AdSense variables are set (RF-58).
export const adsEnabled = (env: Env): boolean =>
  Boolean(env.VITE_ADSENSE_CLIENT && env.VITE_ADSENSE_SLOT);

export const createNonce = (): string => randomBytes(16).toString('base64');

export const renderHtml = (template: string, nonce: string): string =>
  template.replaceAll(NONCE_PLACEHOLDER, nonce);

// The covers come from MyAnimeList's CDN; the catalog itself is served by our API (ADR-0043).
const IMAGES = [
  "'self'",
  'data:',
  'https://cdn.myanimelist.net',
  'https://lh3.googleusercontent.com',
];
const CONNECT = [
  "'self'",
  'https://cdn.myanimelist.net',
  'https://lh3.googleusercontent.com',
  'https://ep-round-snow-b5mftgmf.neonauth.c-7.us-east-2.aws.neon.tech',
  'https://eu.i.posthog.com',
  'https://*.ingest.de.sentry.io',
];

export function contentSecurityPolicy({ nonce, ads }: { nonce: string; ads: boolean }): string {
  // 'strict-dynamic' trusts what the nonced entry script loads (lazy chunks, adsbygoogle.js) and
  // makes CSP3 browsers ignore 'self', 'unsafe-inline' and https:, which stay as old fallbacks.
  const script = ads
    ? [`'nonce-${nonce}'`, "'strict-dynamic'", "'unsafe-inline'", "'unsafe-eval'", 'https:']
    : [`'nonce-${nonce}'`, "'strict-dynamic'", "'self'"];
  // AdSense gives no list for these: its domains change, so ads need any https: origin.
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    ['script-src', script],
    // The service worker registration is not a nonced script, so it needs its own directive.
    ['worker-src', ["'self'"]],
    ['style-src', ads ? ["'self'", "'unsafe-inline'"] : ["'self'"]],
    ['img-src', ads ? [...IMAGES, 'https:'] : IMAGES],
    ['font-src', ["'self'"]],
    ['connect-src', ads ? [...CONNECT, 'https:'] : CONNECT],
    ...(ads
      ? ([
          ['frame-src', ['https:']],
          ['fenced-frame-src', ['https:']],
        ] as [string, string[]][])
      : []),
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['upgrade-insecure-requests', []],
  ];
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ');
}
