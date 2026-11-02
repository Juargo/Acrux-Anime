import { z } from 'zod';

// Vercel can hand over a variable with an empty value; that means not set.
const emptyAsUnset = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Neon Auth (#28). Without it, private routes answer 503 auth.unavailable.
  NEON_AUTH_BASE_URL: z.url().optional(),
  // JWT issuer; defaults to NEON_AUTH_BASE_URL until #28 confirms the claim.
  NEON_AUTH_ISSUER: z.string().min(1).optional(),
  // Sentry (#26). Without a DSN, errors stay in the logs only.
  SENTRY_DSN: z.preprocess(emptyAsUnset, z.url().optional()),
  // Upstash Redis for rate limits (#27). Without both, every request passes.
  UPSTASH_REDIS_REST_URL: z.preprocess(emptyAsUnset, z.url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(emptyAsUnset, z.string().optional()),
  // Set by Vercel on every deployment.
  VERCEL_ENV: z.preprocess(emptyAsUnset, z.string().default('development')),
  VERCEL_GIT_COMMIT_SHA: z.preprocess(emptyAsUnset, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
