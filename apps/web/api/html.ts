import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { adsEnabled, contentSecurityPolicy, createNonce, renderHtml } from './_csp.js';

// Vercel function for every SPA route (vercel.json rewrites them here, ADR-0042). The built
// index.html ships with the function (functions.includeFiles) and is read once per instance.
let template: string | undefined;
const readTemplate = () => readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

export function createHtmlHandler({
  read = readTemplate,
  env = process.env,
  nonce = createNonce,
}: {
  read?: () => string;
  env?: Record<string, string | undefined>;
  nonce?: () => string;
} = {}) {
  return (_req: IncomingMessage, res: ServerResponse) => {
    template ??= read();
    const value = nonce();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // A nonce must never be reused: no shared cache, and the browser revalidates every time.
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader(
      'Content-Security-Policy',
      contentSecurityPolicy({ nonce: value, ads: adsEnabled(env) }),
    );
    res.end(renderHtml(template, value));
  };
}

// Only for tests: forget the cached template.
export const resetTemplate = () => {
  template = undefined;
};

export default createHtmlHandler();
