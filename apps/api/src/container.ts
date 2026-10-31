import type { Logger } from 'pino';
import { parseEnv } from './config/env.js';
import { createLogger } from './http/logger.js';
import type { Module } from './http/routes.js';
import { createNeonAuthVerifier, type SessionVerifier } from './http/session.js';
import { accountModule } from './modules/account/index.js';
import { anilistLinkModule } from './modules/anilist-link/index.js';
import { billingModule } from './modules/billing/index.js';
import { franchisesModule } from './modules/franchises/index.js';
import { marksModule } from './modules/marks/index.js';
import { profileModule } from './modules/profile/index.js';
import { publicProfileModule } from './modules/public-profile/index.js';
import { systemModule } from './modules/system/index.js';

// Composition root: builds every dependency once from the environment.
export interface Container {
  logger: Logger;
  sessionVerifier: SessionVerifier | undefined;
  modules: Module[];
}

export function createContainer(source: Record<string, string | undefined>): Container {
  const env = parseEnv(source);
  return {
    logger: createLogger(env.LOG_LEVEL),
    sessionVerifier: env.NEON_AUTH_BASE_URL
      ? createNeonAuthVerifier(
          env.NEON_AUTH_BASE_URL,
          env.NEON_AUTH_ISSUER ?? env.NEON_AUTH_BASE_URL,
        )
      : undefined,
    modules: [
      systemModule,
      accountModule,
      profileModule,
      marksModule,
      franchisesModule,
      publicProfileModule,
      billingModule,
      anilistLinkModule,
    ],
  };
}
