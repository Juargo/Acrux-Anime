import type { ZodType } from 'zod';

// The browser queries AniList directly (ADR-0024). Nothing here is stored: TanStack Query
// keeps the answers in memory only.
const ENDPOINT = 'https://graphql.anilist.co';
const MAX_RETRIES = 3;
const FIRST_BACKOFF_MS = 1_000;
// AniList counts requests per minute; X-RateLimit-Reset only comes with a 429.
const WINDOW_MS = 60_000;
const MAX_WAIT_MS = 65_000;

export type AniListErrorKind = 'rate-limited' | 'unavailable' | 'invalid-response' | 'query';

export class AniListError extends Error {
  constructor(
    readonly kind: AniListErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AniListError';
  }
}

export interface AniListClient {
  request<T>(query: string, variables: Record<string, unknown>, schema: ZodType<T>): Promise<T>;
}

export interface AniListClientOptions {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  // Called on every 429; #46 sends the anilist_rate_limited event from here (ADR-0030).
  onRateLimited?: (details: { attempt: number }) => void;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// The browser can read X-RateLimit-Reset but not Retry-After, which AniList does not
// expose through CORS (ADR-0024, rule 4).
function resetDelay(response: Response, now: number): number | undefined {
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  if (!Number.isFinite(reset) || reset <= 0) return undefined;
  return Math.min(Math.max(reset * 1000 - now, FIRST_BACKOFF_MS), MAX_WAIT_MS);
}

export function createAniListClient(options: AniListClientOptions = {}): AniListClient {
  const fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? wait;
  let pausedUntil = 0;

  async function send(query: string, variables: Record<string, unknown>): Promise<Response> {
    try {
      return await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new AniListError('unavailable', 'AniList could not be reached');
    }
  }

  return {
    async request(query, variables, schema) {
      for (let attempt = 0; ; attempt++) {
        if (pausedUntil > now()) await sleep(pausedUntil - now());
        const response = await send(query, variables);
        if (response.status === 429) {
          // The 429 already says how long to wait: its reset wins over the window pause.
          try {
            options.onRateLimited?.({ attempt: attempt + 1 });
          } catch {
            // Analytics must never break a catalog query.
          }
          if (attempt >= MAX_RETRIES) {
            throw new AniListError('rate-limited', 'AniList is limiting requests');
          }
          await sleep(resetDelay(response, now()) ?? FIRST_BACKOFF_MS * 2 ** attempt);
          continue;
        }
        if (response.headers.get('x-ratelimit-remaining') === '0') {
          pausedUntil = now() + WINDOW_MS;
        }
        if (response.status >= 500) {
          throw new AniListError('unavailable', `AniList answered ${response.status}`);
        }
        const body = (await response.json().catch(() => undefined)) as
          | { data?: unknown; errors?: unknown[] }
          | undefined;
        if (!response.ok || body?.errors?.length) {
          throw new AniListError('query', `AniList rejected the query (${response.status})`);
        }
        const parsed = schema.safeParse(body?.data);
        if (!parsed.success) {
          throw new AniListError('invalid-response', 'AniList sent an unexpected answer');
        }
        return parsed.data;
      }
    },
  };
}
