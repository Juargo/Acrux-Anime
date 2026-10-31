import { z } from 'zod';

const envSchema = z.object({
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Neon Auth (#28). Without it, private routes answer 503 auth.unavailable.
  NEON_AUTH_BASE_URL: z.url().optional(),
  // JWT issuer; defaults to NEON_AUTH_BASE_URL until #28 confirms the claim.
  NEON_AUTH_ISSUER: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
