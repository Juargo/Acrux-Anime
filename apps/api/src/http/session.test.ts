import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { type Container, createContainer } from '../container.js';
import type { Module } from './routes.js';
import { createJwtVerifier, type SessionVerifier } from './session.js';

// Neon Auth signs session JWTs (ADR-0034). Here a local key pair stands in for its JWKS;
// the real <NEON_AUTH_BASE_URL>/.well-known/jwks.json is wired in #28.
type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

const ISSUER = 'https://auth.test.acrux';
const USER_ID = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';

let verifier: SessionVerifier;
let signWith: (
  claims: Record<string, unknown>,
  options?: { expiresIn?: string | number; key?: SigningKey; issuer?: string },
) => Promise<string>;
let foreignKey: SigningKey;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'EdDSA' };
  verifier = createJwtVerifier({ jwks: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER });
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
        response.json({ userId: response.locals.session.userId });
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
