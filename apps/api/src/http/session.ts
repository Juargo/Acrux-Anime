import type { RequestHandler } from 'express';
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { z } from 'zod';
import { ProblemError, sendProblem } from './problem.js';

// Session of a Neon Auth user (ADR-0025, ADR-0034). Nothing in the token is trusted
// before its signature, issuer and expiration are verified.
export interface Session {
  userId: string;
  // From the Google profile. The email claim is never read (ADR-0028).
  name?: string;
  image?: string;
  // Roles the API knows, from the `role` claim Neon Auth signs (#42). Absent for most users.
  roles?: readonly Role[];
}

// Assigned only from the Neon console or CLI (`neon neon-auth user set-role`, ADR-0034).
export type Role = 'curator';
const ROLES: readonly Role[] = ['curator'];

// Neon Auth sends "authenticated" by default; Better Auth joins several roles with commas.
function knownRoles(claim: unknown): Role[] {
  if (typeof claim !== 'string') return [];
  const named = new Set(claim.split(',').map((role) => role.trim()));
  return ROLES.filter((role) => named.has(role));
}

export type SessionVerifier = (token: string) => Promise<Session>;

const subject = z.uuid();
// Control characters (Postgres rejects NUL) are removed and long names are cut, so a
// Google name never leaves the profile empty or breaks it.
function withoutControlCharacters(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('');
}

const name = z
  .string()
  .transform((value) => withoutControlCharacters(value).trim().slice(0, 100))
  .pipe(z.string().min(1));
// Google profile pictures only; the CSP allows no other avatar host.
const image = z.url({ protocol: /^https$/, hostname: /(^|\.)googleusercontent\.com$/ });

// Neon Auth signs with the origin of its URL as issuer, not the full URL (ADR-0034).
export function neonAuthIssuer(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

export function createJwtVerifier(options: {
  jwks: JWTVerifyGetKey;
  issuer: string;
}): SessionVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, options.jwks, {
      issuer: options.issuer,
      requiredClaims: ['sub', 'exp'],
    });
    const session: Session = { userId: subject.parse(payload.sub) };
    const displayName = name.safeParse(payload.name);
    if (displayName.success) session.name = displayName.data;
    const avatar = image.safeParse(payload.image);
    if (avatar.success) session.image = avatar.data;
    const roles = knownRoles(payload.role);
    if (roles.length > 0) session.roles = roles;
    return session;
  };
}

export function createNeonAuthVerifier(baseUrl: string, issuer: string): SessionVerifier {
  const jwks = createRemoteJWKSet(
    new URL('.well-known/jwks.json', `${baseUrl.replace(/\/$/, '')}/`),
  );
  return createJwtVerifier({ jwks, issuer });
}

function unauthorized(code: string, title: string): ProblemError {
  return new ProblemError(401, code, title);
}

export function requireSession(verifier: SessionVerifier | undefined): RequestHandler {
  return async (request, response, next) => {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      sendProblem(response, unauthorized('auth.missing_token', 'Missing session token'));
      return;
    }
    if (!verifier) {
      sendProblem(response, new ProblemError(503, 'auth.unavailable', 'Sign-in is not available'));
      return;
    }
    try {
      response.locals.session = await verifier(token);
    } catch {
      response.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      sendProblem(response, unauthorized('auth.invalid_token', 'Invalid or expired session'));
      return;
    }
    next();
  };
}

// After requireSession. The role is checked on the server, never trusted from the web (ADR-0025).
export function requireRole(role: Role): RequestHandler {
  return (_request, response, next) => {
    const session: Session | undefined = response.locals.session;
    if (!session?.roles?.includes(role)) {
      sendProblem(response, new ProblemError(403, 'auth.forbidden', 'Not allowed'));
      return;
    }
    next();
  };
}
