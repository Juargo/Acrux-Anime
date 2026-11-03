import type { Logger } from 'pino';
import { parseEnv } from './config/env.js';
import { createPrismaClient } from './db/client.js';
import { type ErrorReporter, noErrorReporter } from './http/error-reporter.js';
import { createLogger } from './http/logger.js';
import { noRateLimiter, type RateLimiter } from './http/rate-limit.js';
import type { Module } from './http/routes.js';
import { createSentryReporter } from './http/sentry-reporter.js';
import { createNeonAuthVerifier, neonAuthIssuer, type SessionVerifier } from './http/session.js';
import { createUpstashRateLimiter } from './http/upstash-rate-limiter.js';
import { accountModule } from './modules/account/index.js';
import { anilistLinkModule } from './modules/anilist-link/index.js';
import { billingModule } from './modules/billing/index.js';
import { franchisesModule } from './modules/franchises/index.js';
import { createMarksModule } from './modules/marks/index.js';
import { createMarksRepository } from './modules/marks/repositories/marks.repository.js';
import { createMarksService, type MarksService } from './modules/marks/services/marks.service.js';
import { createProfileModule } from './modules/profile/index.js';
import { createProfileRepository } from './modules/profile/repositories/profile.repository.js';
import {
  createProfileService,
  type ProfileService,
} from './modules/profile/services/profile.service.js';
import { publicProfileModule } from './modules/public-profile/index.js';
import { systemModule } from './modules/system/index.js';

// Composition root: builds every dependency once from the environment.
export interface Container {
  logger: Logger;
  errorReporter: ErrorReporter;
  rateLimiter: RateLimiter;
  profileService: ProfileService | undefined;
  marksService: MarksService | undefined;
  sessionVerifier: SessionVerifier | undefined;
  modules: Module[];
}

export function createContainer(source: Record<string, string | undefined>): Container {
  const env = parseEnv(source);
  const prisma = env.DATABASE_URL ? createPrismaClient(env.DATABASE_URL) : undefined;
  const profileService = prisma ? createProfileService(createProfileRepository(prisma)) : undefined;
  const marksService =
    prisma && profileService
      ? createMarksService(createMarksRepository(prisma), profileService)
      : undefined;
  return {
    logger: createLogger(env.LOG_LEVEL),
    errorReporter: env.SENTRY_DSN
      ? createSentryReporter({
          dsn: env.SENTRY_DSN,
          environment: env.VERCEL_ENV,
          release: env.VERCEL_GIT_COMMIT_SHA,
        })
      : noErrorReporter,
    rateLimiter:
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? createUpstashRateLimiter({
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
          })
        : noRateLimiter,
    sessionVerifier: env.NEON_AUTH_BASE_URL
      ? createNeonAuthVerifier(
          env.NEON_AUTH_BASE_URL,
          env.NEON_AUTH_ISSUER ?? neonAuthIssuer(env.NEON_AUTH_BASE_URL),
        )
      : undefined,
    profileService,
    marksService,
    modules: createModules(profileService, marksService),
  };
}

// The seven API modules of ADR-0019 plus the system module, in a stable order.
export function createModules(
  profileService: ProfileService | undefined,
  marksService: MarksService | undefined,
): Module[] {
  return [
    systemModule,
    accountModule,
    createProfileModule(profileService),
    createMarksModule(marksService),
    franchisesModule,
    publicProfileModule,
    billingModule,
    anilistLinkModule,
  ];
}
