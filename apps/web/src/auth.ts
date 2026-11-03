import { createAuthClient } from '@neon/auth';
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters';

// Neon Auth (ADR-0034). The SPA talks to it directly; without the URL, sign-in is off,
// as in local development without Neon.
const url = import.meta.env.VITE_NEON_AUTH_URL;

export const auth = url ? createAuthClient(url, { adapter: BetterAuthReactAdapter() }) : undefined;
