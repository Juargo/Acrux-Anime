import type { Logger } from 'pino';
import { parseEnv } from './config/env.js';
import { createPrismaClient } from './db/client.js';
import { type ErrorReporter, noErrorReporter } from './http/error-reporter.js';
import { createLogger } from './http/logger.js';
import type { PlanReader } from './http/plan.js';
import { noRateLimiter, type RateLimiter } from './http/rate-limit.js';
import type { Module } from './http/routes.js';
import { createSentryReporter } from './http/sentry-reporter.js';
import { createNeonAuthVerifier, neonAuthIssuer, type SessionVerifier } from './http/session.js';
import { createUpstashRateLimiter } from './http/upstash-rate-limiter.js';
import { createNeonAuthAdmin } from './modules/account/adapters/neon-auth-admin.js';
import { createPostHogPersons } from './modules/account/adapters/posthog-persons.js';
import { createAccountModule } from './modules/account/index.js';
import {
  type AccountService,
  createAccountService,
} from './modules/account/services/account.service.js';
import { anilistLinkModule } from './modules/anilist-link/index.js';
import { createLemonSqueezyCheckout } from './modules/billing/adapters/lemon-squeezy-checkout.js';
import { type BillingDependencies, createBillingModule } from './modules/billing/index.js';
import { createEntitlementRepository } from './modules/billing/repositories/entitlement.repository.js';
import { createFranchisesModule } from './modules/franchises/index.js';
import {
  createFranchiseOverridesRepository,
  type FranchiseOverridesRepository,
} from './modules/franchises/repositories/franchise-overrides.repository.js';
import { createMarksModule } from './modules/marks/index.js';
import { createMarksRepository } from './modules/marks/repositories/marks.repository.js';
import { createMarksService, type MarksService } from './modules/marks/services/marks.service.js';
import { analyticsId } from './modules/profile/domain/analytics-id.js';
import { createProfileModule } from './modules/profile/index.js';
import { createProfileRepository } from './modules/profile/repositories/profile.repository.js';
import {
  createProfileService,
  type ProfileService,
} from './modules/profile/services/profile.service.js';
import { createPublicProfileModule } from './modules/public-profile/index.js';
import {
  createPublicProfileService,
  type PublicProfileService,
} from './modules/public-profile/services/public-profile.service.js';
import { systemModule } from './modules/system/index.js';

// Composition root: builds every dependency once from the environment.
export interface Container {
  logger: Logger;
  errorReporter: ErrorReporter;
  rateLimiter: RateLimiter;
  profileService: ProfileService | undefined;
  marksService: MarksService | undefined;
  sessionVerifier: SessionVerifier | undefined;
  // Reads the plan from the database for requirePlan; undefined without a database.
  planOf?: PlanReader | undefined;
  modules: Module[];
}

export function createContainer(source: Record<string, string | undefined>): Container {
  const env = parseEnv(source);
  const prisma = env.DATABASE_URL ? createPrismaClient(env.DATABASE_URL) : undefined;
  const profileRepository = prisma ? createProfileRepository(prisma) : undefined;
  const profileService = profileRepository
    ? createProfileService(profileRepository, { analyticsSecret: env.ANALYTICS_ID_SECRET })
    : undefined;
  const marksRepository = prisma ? createMarksRepository(prisma) : undefined;
  const marksService =
    marksRepository && profileService
      ? createMarksService(marksRepository, profileService)
      : undefined;
  const publicProfileService =
    profileService && marksService
      ? createPublicProfileService(profileService, marksService)
      : undefined;
  const analyticsSecret = env.ANALYTICS_ID_SECRET;
  const accountService =
    profileService && marksService
      ? createAccountService({
          profiles: profileService,
          marks: marksService,
          directory:
            env.NEON_API_KEY && env.NEON_PROJECT_ID && env.NEON_BRANCH_ID
              ? createNeonAuthAdmin({
                  apiKey: env.NEON_API_KEY,
                  projectId: env.NEON_PROJECT_ID,
                  branchId: env.NEON_BRANCH_ID,
                })
              : undefined,
          persons:
            env.POSTHOG_PERSONAL_API_KEY && env.POSTHOG_PROJECT_ID
              ? createPostHogPersons({
                  apiKey: env.POSTHOG_PERSONAL_API_KEY,
                  projectId: env.POSTHOG_PROJECT_ID,
                  host: env.POSTHOG_API_HOST,
                })
              : undefined,
          analyticsIdOf: (userId) =>
            analyticsSecret ? analyticsId(userId, analyticsSecret) : null,
        })
      : undefined;
  const entitlements = prisma ? createEntitlementRepository(prisma) : undefined;
  const planOf = entitlements?.planOf;
  const errorReporter = env.SENTRY_DSN
    ? createSentryReporter({
        dsn: env.SENTRY_DSN,
        environment: env.VERCEL_ENV,
        release: env.VERCEL_GIT_COMMIT_SHA,
      })
    : noErrorReporter;
  return {
    logger: createLogger(env.LOG_LEVEL),
    errorReporter,
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
          env.CURATOR_USER_IDS,
        )
      : undefined,
    profileService,
    marksService,
    planOf,
    modules: createModules(
      profileService,
      marksService,
      publicProfileService,
      {
        service: accountService,
        errorReporter,
      },
      prisma ? createFranchiseOverridesRepository(prisma) : undefined,
      prisma &&
        env.LEMON_SQUEEZY_API_KEY &&
        env.LEMON_SQUEEZY_STORE_ID &&
        env.LEMON_SQUEEZY_VARIANT_ID &&
        env.LEMON_SQUEEZY_WEBHOOK_SECRET
        ? {
            entitlements: entitlements ?? createEntitlementRepository(prisma),
            checkout: createLemonSqueezyCheckout({
              apiKey: env.LEMON_SQUEEZY_API_KEY,
              storeId: env.LEMON_SQUEEZY_STORE_ID,
              variantId: env.LEMON_SQUEEZY_VARIANT_ID,
            }),
            returnUrl: env.BILLING_RETURN_URL,
            webhookSecret: env.LEMON_SQUEEZY_WEBHOOK_SECRET,
            storeId: env.LEMON_SQUEEZY_STORE_ID,
            variantId: env.LEMON_SQUEEZY_VARIANT_ID,
            errorReporter,
          }
        : undefined,
      planOf,
    ),
  };
}

// The seven API modules of ADR-0019 plus the system module, in a stable order.
export function createModules(
  profileService: ProfileService | undefined,
  marksService: MarksService | undefined,
  publicProfileService?: PublicProfileService,
  account?: { service: AccountService | undefined; errorReporter: ErrorReporter },
  franchiseOverrides?: FranchiseOverridesRepository,
  billing?: BillingDependencies,
  planOf?: PlanReader,
): Module[] {
  return [
    systemModule,
    createAccountModule(account?.service, account?.errorReporter),
    createProfileModule(profileService, { planOf, plusAvailable: billing !== undefined }),
    createMarksModule(marksService),
    createFranchisesModule(franchiseOverrides),
    createPublicProfileModule(publicProfileService),
    createBillingModule(billing),
    anilistLinkModule,
  ];
}
