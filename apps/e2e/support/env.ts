// Addresses of the E2E stack (ADR-0037). Everything runs on localhost: the built web, the
// built API and the fake Neon Auth server. Nothing here reaches production.

export const WEB_PORT = 4173;
export const API_PORT = 3001;
export const FAKE_AUTH_PORT = 4010;

export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;
export const FAKE_AUTH_URL = `http://localhost:${FAKE_AUTH_PORT}`;

// What the API calls NEON_AUTH_BASE_URL: it fetches the JWKS from here, and the token issuer
// is its origin, as with the real Neon Auth.
export const FAKE_NEON_AUTH_BASE_URL = `${FAKE_AUTH_URL}/neon-auth`;
// Where the fake server answers the Neon API calls of account deletion.
export const FAKE_NEON_API_URL = `${FAKE_AUTH_URL}/neon-api/`;

// VITE_NEON_AUTH_URL of the web built for E2E. Same origin as the web, so the routes that
// Playwright installs answer without CORS; nothing ever listens there.
export const BROWSER_NEON_AUTH_PATH = '/neon-auth';
export const BROWSER_NEON_AUTH_URL = `${WEB_URL}${BROWSER_NEON_AUTH_PATH}`;
