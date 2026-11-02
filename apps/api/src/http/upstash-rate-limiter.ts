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

// A slow store fails the check, and the API lets the request through.
const TIMEOUT_MS = 1000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Rate limit store did not answer in time');
      error.name = 'TimeoutError';
      reject(error);
    }, TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Fixed window: one counter per key and window, created and expired in one transaction.
// Only standard commands, so any Redis behind the Upstash REST API behaves the same.
export function createUpstashRateLimiter(options: {
  url: string;
  token: string;
  policies?: Record<RateLimitPolicy, PolicyLimit>;
}): RateLimiter {
  const redis = new Redis({ url: options.url, token: options.token, retry: false });
  const policies = options.policies ?? DEFAULT_POLICIES;

  return {
    limit: async (policy, key) => {
      const { requests, windowSeconds } = policies[policy];
      const nowSeconds = Date.now() / 1000;
      const windowEnd = (Math.floor(nowSeconds / windowSeconds) + 1) * windowSeconds;
      const counter = `acrux:${policy}:${key}:${windowEnd}`;
      const [count] = await withTimeout(
        redis.multi().incr(counter).expireat(counter, windowEnd).exec<[number, number]>(),
      );
      return {
        allowed: count <= requests,
        retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowSeconds)),
      };
    },
  };
}
