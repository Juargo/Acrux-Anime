import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { adsEnabled, contentSecurityPolicy, createNonce, NONCE_PLACEHOLDER } from './_csp';
import { createHtmlHandler, resetTemplate } from './html';

const TEMPLATE = `<!doctype html><html><head>
<meta property="csp-nonce" nonce="${NONCE_PLACEHOLDER}">
<script type="module" crossorigin src="/assets/index.js" nonce="${NONCE_PLACEHOLDER}"></script>
<link rel="modulepreload" href="/assets/chunk.js" nonce="${NONCE_PLACEHOLDER}">
</head><body><div id="root"></div></body></html>`;

const ADS = { VITE_ADSENSE_CLIENT: 'ca-pub-1', VITE_ADSENSE_SLOT: '123' };

function serve(env: Record<string, string | undefined>, nonces: string[]) {
  const handler = createHtmlHandler({
    read: () => TEMPLATE,
    env,
    nonce: () => nonces.shift() ?? 'none',
  });
  const headers = new Map<string, string>();
  let body = '';
  const res = {
    statusCode: 0,
    setHeader: (key: string, value: string) => headers.set(key.toLowerCase(), value),
    end: (chunk: string) => {
      body = chunk;
    },
  };
  handler({} as IncomingMessage, res as unknown as ServerResponse);
  return { status: res.statusCode, headers, body };
}

const directive = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((part) => part === name || part.startsWith(`${name} `))
    ?.split(' ')
    .slice(1);

afterEach(resetTemplate);

describe('the SPA document', () => {
  it('carries a fresh nonce on every tag and in script-src', () => {
    const first = serve({}, ['bm9uY2Ux']);
    const policy = first.headers.get('content-security-policy') ?? '';

    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(first.body).not.toContain(NONCE_PLACEHOLDER);
    expect(first.body.match(/nonce="bm9uY2Ux"/g)).toHaveLength(3);
    expect(directive(policy, 'script-src')).toEqual([
      "'nonce-bm9uY2Ux'",
      "'strict-dynamic'",
      "'self'",
    ]);

    const second = serve({}, ['bm9uY2Uy']);
    expect(second.body).toContain('nonce="bm9uY2Uy"');
    expect(second.headers.get('content-security-policy')).toContain("'nonce-bm9uY2Uy'");
  });

  it('is never kept in a shared cache', () => {
    expect(serve({}, ['n']).headers.get('cache-control')).toBe('private, no-cache');
  });

  it('keeps today’s directives while ads are off', () => {
    const policy = serve({ VITE_ADSENSE_CLIENT: 'ca-pub-1' }, ['n']).headers.get(
      'content-security-policy',
    );

    expect(policy).toBe(
      "default-src 'self'; script-src 'nonce-n' 'strict-dynamic' 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data: https://cdn.myanimelist.net https://lh3.googleusercontent.com; font-src 'self'; connect-src 'self' https://cdn.myanimelist.net https://lh3.googleusercontent.com https://ep-round-snow-b5mftgmf.neonauth.c-7.us-east-2.aws.neon.tech https://eu.i.posthog.com https://*.ingest.de.sentry.io; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
    );
  });

  it('opens what AdSense needs once both variables are set', () => {
    const policy = serve(ADS, ['n']).headers.get('content-security-policy') ?? '';

    expect(directive(policy, 'script-src')).toEqual([
      "'nonce-n'",
      "'strict-dynamic'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https:',
    ]);
    expect(directive(policy, 'frame-src')).toEqual(['https:']);
    expect(directive(policy, 'fenced-frame-src')).toEqual(['https:']);
    expect(directive(policy, 'img-src')).toContain('https:');
    expect(directive(policy, 'connect-src')).toContain('https:');
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'frame-ancestors')).toEqual(["'none'"]);
  });
});

describe('the CSP helpers', () => {
  it('need both AdSense variables', () => {
    expect(adsEnabled({})).toBe(false);
    expect(adsEnabled({ VITE_ADSENSE_SLOT: '1' })).toBe(false);
    expect(adsEnabled(ADS)).toBe(true);
  });

  it('create a different 128-bit nonce each time', () => {
    const a = createNonce();
    expect(Buffer.from(a, 'base64')).toHaveLength(16);
    expect(createNonce()).not.toBe(a);
  });

  it('never allow plugins or framing', () => {
    for (const ads of [false, true]) {
      const policy = contentSecurityPolicy({ nonce: 'n', ads });
      expect(directive(policy, 'object-src')).toEqual(["'none'"]);
      expect(directive(policy, 'worker-src')).toEqual(["'self'"]);
    }
  });
});
