import { Redis } from '@upstash/redis';

// Same fixed window as the API (apps/api/src/http/upstash-rate-limiter.ts). Each app keeps
// its own counters, so the code is duplicated instead of shipping a compiled shared package.

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export type Limit = (key: string) => Promise<LimitResult>;

const TIMEOUT_MS = 1000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Rate limit store did not answer in time');
      error.name = 'TimeoutError';
      reject(error);
    }, TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function createUpstashFixedWindow(options: {
  url: string;
  token: string;
  requests: number;
  windowSeconds: number;
}): Limit {
  const redis = new Redis({ url: options.url, token: options.token, retry: false });
  return async (key) => {
    const nowSeconds = Date.now() / 1000;
    const windowEnd = (Math.floor(nowSeconds / options.windowSeconds) + 1) * options.windowSeconds;
    const counter = `acrux:waitlist:${key}:${windowEnd}`;
    const [count] = await withTimeout(
      redis.multi().incr(counter).expireat(counter, windowEnd).exec<[number, number]>(),
    );
    return {
      allowed: count <= options.requests,
      retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowSeconds)),
    };
  };
}
