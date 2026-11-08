import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { type Container, createContainer } from '../container.js';
import type { Module } from './routes.js';
import { createJwtVerifier, neonAuthIssuer, type SessionVerifier } from './session.js';

// Neon Auth signs session JWTs (ADR-0034). Here a local key pair stands in for its JWKS;
// the real <NEON_AUTH_BASE_URL>/.well-known/jwks.json is wired in #28.
type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

const ISSUER = 'https://auth.test.acrux';
const USER_ID = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const CURATOR_ID = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e6f';

let verifier: SessionVerifier;
let withCurators: SessionVerifier;
let signWith: (
  claims: Record<string, unknown>,
  options?: { expiresIn?: string | number; key?: SigningKey; issuer?: string },
) => Promise<string>;
let foreignKey: SigningKey;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'EdDSA' };
  verifier = createJwtVerifier({ jwks: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER });
  withCurators = createJwtVerifier({
    jwks: createLocalJWKSet({ keys: [jwk] }),
    issuer: ISSUER,
    curators: [CURATOR_ID],
  });
  foreignKey = (await generateKeyPair('EdDSA', { crv: 'Ed25519' })).privateKey;

  signWith = (claims, options = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
      .setIssuer(options.issuer ?? ISSUER)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '5m')
      .sign(options.key ?? privateKey);
});

const privateModule: Module = {
  name: 'test',
  routes: [
    {
      method: 'get',
      path: '/api/v1/test/me',
      handler: (_request, response) => {
        response.json({ userId: response.locals.session?.userId });
      },
    },
  ],
};

function appWith(sessionVerifier: SessionVerifier | undefined): Container {
  const base = createContainer({});
  return { ...base, sessionVerifier, modules: [...base.modules, privateModule] };
}

describe('private routes', () => {
  it('answer 401 without a token', async () => {
    const response = await request(createApp(appWith(verifier))).get('/api/v1/test/me');

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.body).toMatchObject({ status: 401, code: 'auth.missing_token' });
  });

  it('answer 401 when the Authorization header is not a Bearer token', async () => {
    const response = await request(createApp(appWith(verifier)))
      .get('/api/v1/test/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('auth.missing_token');
  });

  it('pass the verified user id to the handler', async () => {
    const token = await signWith({ sub: USER_ID });
    const response = await request(createApp(appWith(verifier)))
      .get('/api/v1/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: USER_ID });
  });

  it('answer 401 for a token signed with another key', async () => {
    const token = await signWith({ sub: USER_ID }, { key: foreignKey });
    const response = await request(createApp(appWith(verifier)))
      .get('/api/v1/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('auth.invalid_token');
  });

  it('answer 401 for an expired token', async () => {
    const token = await signWith(
      { sub: USER_ID },
      { expiresIn: Math.floor(Date.now() / 1000) - 60 },
    );
    const response = await request(createApp(appWith(verifier)))
      .get('/api/v1/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('auth.invalid_token');
  });

  it('answer 401 for a token from another issuer', async () => {
    const token = await signWith({ sub: USER_ID }, { issuer: 'https://evil.example' });
    const response = await request(createApp(appWith(verifier)))
      .get('/api/v1/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('auth.invalid_token');
  });

  it('answer 401 for an unsigned token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: USER_ID, iss: ISSUER, exp: Math.floor(Date.now() / 1000) + 300 }),
    ).toString('base64url');
    const response = await request(createApp(appWith(verifier)))
      .get('/api/v1/test/me')
      .set('Authorization', `Bearer ${header}.${payload}.`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('auth.invalid_token');
  });

  it('answer 401 when the subject is not a user uuid', async () => {
    const token = await signWith({ sub: 'admin' });
    const response = await request(createApp(appWith(verifier)))
      .get('/api/v1/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('auth.invalid_token');
  });

  it('answer 503 while Neon Auth is not configured', async () => {
    const token = await signWith({ sub: USER_ID });
    const response = await request(createApp(appWith(undefined)))
      .get('/api/v1/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('auth.unavailable');
  });
});

describe('public routes', () => {
  it('do not ask for a session', async () => {
    const response = await request(createApp(appWith(verifier))).get('/api/health');
    expect(response.status).toBe(200);
  });
});

describe('session claims', () => {
  it('carries the Google name and avatar, and never the email', async () => {
    const token = await signWith({
      sub: USER_ID,
      name: 'Camila',
      image: 'https://lh3.googleusercontent.com/a/camila',
      email: 'camila@correo.com',
    });
    expect(await verifier(token)).toEqual({
      userId: USER_ID,
      name: 'Camila',
      image: 'https://lh3.googleusercontent.com/a/camila',
    });
  });

  it('drops a missing name or an avatar that is not an https URL', async () => {
    const token = await signWith({ sub: USER_ID, image: 'javascript:alert(1)' });
    expect(await verifier(token)).toEqual({ userId: USER_ID });
  });
});

describe('session claims from untrusted shapes', () => {
  it('keeps the first 100 characters of a long name and strips control characters', async () => {
    const token = await signWith({ sub: USER_ID, name: `  Cami\u0000la ${'x'.repeat(200)}` });
    const session = await verifier(token);
    expect(session.name).toHaveLength(100);
    expect(session.name?.startsWith('Camila x')).toBe(true);
  });

  it('only accepts a Google avatar', async () => {
    const google = await signWith({ sub: USER_ID, image: 'https://lh3.googleusercontent.com/a/x' });
    expect((await verifier(google)).image).toBe('https://lh3.googleusercontent.com/a/x');
    const other = await signWith({ sub: USER_ID, image: 'https://evil.example/a.png' });
    expect((await verifier(other)).image).toBeUndefined();
  });
});

describe('the curator role (#42)', () => {
  it('is granted to the user IDs in CURATOR_USER_IDS', async () => {
    const token = await signWith({ sub: CURATOR_ID, role: 'authenticated' });
    expect(await withCurators(token)).toEqual({ userId: CURATOR_ID, roles: ['curator'] });
  });

  it('is never granted by the role claim, which Neon Auth always signs as authenticated', async () => {
    for (const role of ['curator', 'authenticated, curator', ['curator']]) {
      const token = await signWith({ sub: USER_ID, role });
      expect(await withCurators(token), String(role)).toEqual({ userId: USER_ID });
    }
  });
});

describe('neonAuthIssuer', () => {
  it('is the origin of the Neon Auth URL, without its path', () => {
    expect(neonAuthIssuer('https://ep-x.neonauth.us-east-2.aws.neon.tech/neondb/auth')).toBe(
      'https://ep-x.neonauth.us-east-2.aws.neon.tech',
    );
  });
});
