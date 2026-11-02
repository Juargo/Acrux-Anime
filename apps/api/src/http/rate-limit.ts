import { createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ProblemError, sendProblem } from './problem.js';

// Writes count per user; public routes count per client IP (ADR-0028).
export type RateLimitPolicy = 'write' | 'public';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  limit(policy: RateLimitPolicy, key: string): Promise<RateLimitResult>;
}

// Without a store every request passes, as in local development.
export const noRateLimiter: RateLimiter = {
  limit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
};

// Vercel overwrites this header, so a client cannot spoof it. Locally it is absent.
function clientIp(request: Request): string {
  const forwarded = request.headers['x-vercel-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown';
}

// The store only sees a hash, never the IP or the user id.
function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function rateLimit(
  policy: RateLimitPolicy,
  limiter: RateLimiter,
  logger: Logger,
): RequestHandler {
  return async (request, response, next) => {
    const subject = response.locals.session?.userId
      ? `user:${response.locals.session.userId}`
      : `ip:${clientIp(request)}`;
    let result: RateLimitResult;
    try {
      result = await limiter.limit(policy, hashKey(subject));
    } catch (error) {
      // A store outage must not take the API down.
      logger.warn(
        { requestId: response.locals.requestId, reason: (error as Error)?.name },
        'rate limit check failed',
      );
      next();
      return;
    }
    if (result.allowed) {
      next();
      return;
    }
    response.setHeader('Retry-After', String(result.retryAfterSeconds));
    sendProblem(response, new ProblemError(429, 'rate_limited', 'Too Many Requests'));
  };
}
