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
}

export type SessionVerifier = (token: string) => Promise<Session>;

const subject = z.uuid();
const name = z.string().trim().min(1).max(100);
const image = z.url({ protocol: /^https$/ });

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
