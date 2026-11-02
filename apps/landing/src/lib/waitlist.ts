import type { Limit } from './rate-limit';

// Waitlist sign-up against Buttondown (ADR-0033). The API key lives only on the server.
// The email is never logged or returned (ADR-0030).

export type WaitlistStatus = 'ok' | 'already' | 'invalid' | 'limited' | 'error';

export interface WaitlistDeps {
  apiKey: string | undefined;
  fetch: typeof fetch;
  // Per client IP (ADR-0028). Without it every attempt passes, as in local development.
  limit?: Limit;
}

// Vercel overwrites this header, so a client cannot spoof it. Web Crypto keeps
// `node:crypto` out of this module, which the browser script also imports.
async function clientIpKey(request: Request): Promise<string> {
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ip:${ip}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// A store outage must not block sign-ups.
async function retryAfter(request: Request, limit: Limit | undefined): Promise<number | undefined> {
  if (!limit) return undefined;
  try {
    const result = await limit(await clientIpKey(request));
    return result.allowed ? undefined : result.retryAfterSeconds;
  } catch {
    return undefined;
  }
}

const BUTTONDOWN_SUBSCRIBERS_URL = 'https://api.buttondown.com/v1/subscribers';
const ALREADY_EXISTS_CODES = new Set(['email_already_exists', 'subscriber_already_exists']);

// Same rule the form applies in the browser: something@domain.suffix, no spaces.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function reply(status: WaitlistStatus, httpStatus: number): Response {
  return Response.json({ status }, { status: httpStatus });
}

async function readEmail(request: Request): Promise<string | undefined> {
  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null && 'email' in body) {
      const { email } = body;
      return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
    }
  } catch {
    // Malformed JSON is treated as an invalid email.
  }
  return undefined;
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'code' in body) {
      return typeof body.code === 'string' ? body.code : undefined;
    }
  } catch {
    // A non-JSON error body has no code.
  }
  return undefined;
}

export async function handleWaitlistRequest(
  request: Request,
  deps: WaitlistDeps,
): Promise<Response> {
  const wait = await retryAfter(request, deps.limit);
  if (wait !== undefined) {
    return Response.json(
      { status: 'limited' },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }
  const email = await readEmail(request);
  if (!email || !isValidEmail(email)) return reply('invalid', 400);
  if (!deps.apiKey) return reply('error', 502);

  let response: Response;
  try {
    // No "type": Buttondown keeps double opt-in and sends the confirmation email.
    response = await deps.fetch(BUTTONDOWN_SUBSCRIBERS_URL, {
      method: 'POST',
      headers: {
        authorization: `Token ${deps.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email_address: email }),
    });
  } catch {
    return reply('error', 502);
  }

  if (response.ok) return reply('ok', 200);
  if (response.status === 400 && ALREADY_EXISTS_CODES.has((await errorCode(response)) ?? '')) {
    return reply('already', 200);
  }
  return reply('error', 502);
}
