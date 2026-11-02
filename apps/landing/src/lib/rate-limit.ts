import { Redis } from '@upstash/redis';

// Same fixed window as the API (apps/api/src/http/upstash-rate-limiter.ts). Each app keeps
// its own counters, so the code is duplicated instead of shipping a compiled shared package.

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export type Limit = (key: string) => Promise<LimitResult>;

// A slow store fails the check, and the caller lets the request through.
const TIMEOUT_MS = 1000;

export function createUpstashFixedWindow(options: {
  url: string;
  token: string;
  requests: number;
  windowSeconds: number;
}): Limit {
  const redis = new Redis({
    url: options.url,
    token: options.token,
    retry: false,
    // Aborts the request itself, so a hung store does not keep the function running.
    signal: () => AbortSignal.timeout(TIMEOUT_MS),
  });
  return async (key) => {
    const nowSeconds = Date.now() / 1000;
    const windowEnd = (Math.floor(nowSeconds / options.windowSeconds) + 1) * options.windowSeconds;
    const counter = `acrux:waitlist:${key}:${windowEnd}`;
    const [count] = await redis
      .multi()
      .incr(counter)
      .expireat(counter, windowEnd)
      .exec<[number, number]>();
    // An aborted or malformed answer is a store failure, never a denial.
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      throw new Error('Rate limit store gave no usable answer');
    }
    return {
      allowed: count <= options.requests,
      retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowSeconds)),
    };
  };
}
