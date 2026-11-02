import { Redis } from '@upstash/redis';
import type { RateLimiter, RateLimitPolicy } from './rate-limit.js';

export interface PolicyLimit {
  requests: number;
  windowSeconds: number;
}

// Defaults until real traffic says otherwise (odd/tasks/limite-de-peticiones.md, L3).
export const DEFAULT_POLICIES: Record<RateLimitPolicy, PolicyLimit> = {
  write: { requests: 30, windowSeconds: 60 },
  public: { requests: 60, windowSeconds: 60 },
};

// A slow store fails the check, and the caller lets the request through.
const TIMEOUT_MS = 1000;

// Fixed window: one counter per key and window, created and expired in one transaction.
// Only standard commands, so any Redis behind the Upstash REST API behaves the same.
export function createUpstashRateLimiter(options: {
  url: string;
  token: string;
  policies?: Record<RateLimitPolicy, PolicyLimit>;
}): RateLimiter {
  const redis = new Redis({
    url: options.url,
    token: options.token,
    retry: false,
    // Aborts the request itself, so a hung store does not keep the function running.
    signal: () => AbortSignal.timeout(TIMEOUT_MS),
  });
  const policies = options.policies ?? DEFAULT_POLICIES;

  return {
    limit: async (policy, key) => {
      const { requests, windowSeconds } = policies[policy];
      const nowSeconds = Date.now() / 1000;
      const windowEnd = (Math.floor(nowSeconds / windowSeconds) + 1) * windowSeconds;
      const counter = `acrux:${policy}:${key}:${windowEnd}`;
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
        allowed: count <= requests,
        retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowSeconds)),
      };
    },
  };
}
