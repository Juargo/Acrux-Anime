// Fake Neon Auth for E2E (ADR-0037). A key pair made at startup signs the session JWTs; the
// API verifies them against the JWKS published here, as it does against Neon Auth. It also
// answers the Neon API call that deletes the auth user. Run with `node`.
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { FAKE_AUTH_PORT, FAKE_AUTH_URL } from './env.ts';

const ALG = 'ES256';
const kid = randomUUID();
const { publicKey, privateKey } = await generateKeyPair(ALG);
const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid, alg: ALG, use: 'sig' }] };
const deletedUsers = new Set<string>();

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

// The claims the API reads: sub (uuid), exp, the Google name and the role (#42). Neon Auth
// sends role "authenticated" unless `neon neon-auth user set-role` changed it. Issuer: the origin.
async function mintToken(body: Record<string, unknown>): Promise<string> {
  const claims: Record<string, unknown> = {
    role: typeof body.role === 'string' ? body.role : 'authenticated',
  };
  if (typeof body.name === 'string') claims.name = body.name;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG, kid })
    .setSubject(String(body.sub))
    .setIssuer(FAKE_AUTH_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', FAKE_AUTH_URL);
  try {
    if (request.method === 'GET' && pathname === '/health') return send(response, 200, {});
    if (request.method === 'GET' && pathname === '/neon-auth/.well-known/jwks.json') {
      return send(response, 200, jwks);
    }
    // Test only: the token the browser routes hand to the app as its session.
    if (request.method === 'POST' && pathname === '/test/tokens') {
      return send(response, 200, { token: await mintToken(await readJson(request)) });
    }
    if (request.method === 'GET' && pathname.startsWith('/test/deleted-users/')) {
      const userId = decodeURIComponent(pathname.slice('/test/deleted-users/'.length));
      return send(response, 200, { deleted: deletedUsers.has(userId) });
    }
    // DELETE /neon-api/projects/{project}/branches/{branch}/auth/users/{user} (Neon API v2).
    const deletion = /^\/neon-api\/projects\/[^/]+\/branches\/[^/]+\/auth\/users\/([^/]+)$/.exec(
      pathname,
    );
    if (request.method === 'DELETE' && deletion?.[1]) {
      deletedUsers.add(decodeURIComponent(deletion[1]));
      return send(response, 200, {});
    }
    send(response, 404, { message: 'Not found' });
  } catch (error) {
    send(response, 500, { message: String(error) });
  }
});

server.listen(FAKE_AUTH_PORT, () => {
  console.log(`Fake Neon Auth listening on ${FAKE_AUTH_URL}`);
});
