import { z } from 'zod';

// Vercel can hand over a variable with an empty value; that means not set.
const emptyAsUnset = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Neon Auth (#28). Without it, private routes answer 503 auth.unavailable.
  NEON_AUTH_BASE_URL: z.url().optional(),
  // JWT issuer; defaults to the origin of NEON_AUTH_BASE_URL (#28).
  NEON_AUTH_ISSUER: z.string().min(1).optional(),
  // Comma-separated Neon Auth user IDs with the curator role (#42, ADR-0034). Unset: nobody.
  CURATOR_USER_IDS: z.preprocess(
    emptyAsUnset,
    z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((id) => id.trim().toLowerCase())
          .filter(Boolean),
      ),
  ),
  // Pooled Neon connection with the acrux_api role (ADR-0034). Without it, /api/v1/me
  // answers 503.
  DATABASE_URL: z.preprocess(emptyAsUnset, z.url().optional()),
  // MyAnimeList client id (ADR-0043). Server only: the API agreement forbids sharing it.
  // Without it the catalog serves only what the table holds, with no fill on demand.
  MAL_CLIENT_ID: z.preprocess(emptyAsUnset, z.string().min(1).optional()),
  // Sentry (#26). Without a DSN, errors stay in the logs only.
  SENTRY_DSN: z.preprocess(emptyAsUnset, z.url().optional()),
  // Upstash Redis for rate limits (#27). Without both, every request passes.
  UPSTASH_REDIS_REST_URL: z.preprocess(emptyAsUnset, z.url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyAsUnset, z.string().optional()),
  // Key of the salted id PostHog knows users by (#46). Without it, /me gives no analyticsId
  // and the app captures anonymously.
  ANALYTICS_ID_SECRET: z.preprocess(emptyAsUnset, z.string().min(32).optional()),
  // Neon API key and the project and branch whose Neon Auth users it deletes (#38, ADR-0034).
  // Server only. Without all three, DELETE /api/v1/me answers 503 and deletes nothing.
  NEON_API_KEY: z.preprocess(emptyAsUnset, z.string().optional()),
  NEON_PROJECT_ID: z.preprocess(emptyAsUnset, z.string().optional()),
  NEON_BRANCH_ID: z.preprocess(emptyAsUnset, z.string().optional()),
  // PostHog personal API key with person:write and its project (#38). Without both, deleting
  // an account leaves the PostHog person, who is only a salted id.
  POSTHOG_PERSONAL_API_KEY: z.preprocess(emptyAsUnset, z.string().optional()),
  POSTHOG_PROJECT_ID: z.preprocess(emptyAsUnset, z.string().optional()),
  POSTHOG_API_HOST: z.preprocess(emptyAsUnset, z.url().default('https://eu.posthog.com')),
  // Lemon Squeezy (epic #50). Server only. Billing stays off, and its routes answer 503,
  // until all four are set: Plus is not sold before the AniList licence (ADR-0036).
  LEMON_SQUEEZY_API_KEY: z.preprocess(emptyAsUnset, z.string().optional()),
  LEMON_SQUEEZY_STORE_ID: z.preprocess(emptyAsUnset, z.string().regex(/^\d+$/).optional()),
  LEMON_SQUEEZY_VARIANT_ID: z.preprocess(emptyAsUnset, z.string().regex(/^\d+$/).optional()),
  LEMON_SQUEEZY_WEBHOOK_SECRET: z.preprocess(emptyAsUnset, z.string().min(16).optional()),
  // The Plus screen Lemon Squeezy sends the buyer back to; previews set their own.
  BILLING_RETURN_URL: z.preprocess(
    emptyAsUnset,
    z.url({ protocol: /^https$/ }).default('https://app.acruxanime.com/perfil/plus'),
  ),
  // Set by Vercel on every deployment.
  VERCEL_ENV: z.preprocess(emptyAsUnset, z.string().default('development')),
  VERCEL_GIT_COMMIT_SHA: z.preprocess(emptyAsUnset, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
