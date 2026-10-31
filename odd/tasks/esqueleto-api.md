# Feature: API skeleton (issue #23)

Objective: the base every API module builds on: modules wired by `createApp(container)`, private routes by default with a Neon Auth session, request ids, safe JSON logs, RFC 9457 errors, the OpenAPI contract and layer rules in CI.
Branch: `feat/esqueleto-api` · Delivery: `ask-on-risk` · Test runner: Vitest + Supertest.

## Specs

- S1 (issue #23): "`createApp(container)` con módulos `account`, `profile`, `marks`, `franchises`, `public-profile`, `billing`, `anilist-link`".
- S2 (issue #23): "*Middleware* de sesión: verifica el JWT de Neon Auth con JWKS (`jose`, `<NEON_AUTH_BASE_URL>/.well-known/jwks.json`), `iss` y expiración (ADR-0034); rutas privadas salvo `public: true`". Assumption (stakeholder "si", 2026-10-31): verified with local test keys now; wired to the real Neon Auth URL in #28.
- S3 (issue #23): "`requestId` generado y devuelto en `X-Request-Id`".
- S4 (issue #23): "`pino` en JSON con `redact` de tokens, `Authorization`, correos y cuerpos de webhooks".
- S5 (issue #23): "Errores `application/problem+json` con `code` estable".
- S6 (issue #23): "Emisión y verificación del contrato OpenAPI (`openapi:emit`, `openapi:check`)".
- S7 (issue #23): "`dependency-cruiser` con las reglas de ADR-0019 en CI".
- S8 (acceptance): "Una ruta nueva sin `public: true` responde 401 sin token".
- S9 (acceptance): "Un token con firma inválida o expirado responde 401".
- S10 (acceptance): "Ningún log contiene la cabecera `Authorization`".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S3, S4, S5, S10 | inline | done (1e7785c) | container, modules, route definitions, request id, logger, problem errors |
| T2 | S2, S8, S9 | inline | done (2a8fbdd) | session middleware with `jose`, tests with a local JWKS |
| T3 | S6, S7 | inline | done (6df4a8d, CI e5cbbc0) | OpenAPI emit/check, dependency-cruiser, CI steps |

## Log

- L1 (2026-10-31, stakeholder): "si" to starting #23 with JWT verification tested against local keys and connected to Neon Auth in #28.
- L2: T1 RED `Cannot find module './container.js'`; GREEN 25 tests. Logs never receive headers or bodies; pino `redact` (remove) as a second layer. The test helper first dropped the system module (404 on health): test bug, fixed.
- L3: T2 RED `Cannot find module './session.js'`; GREEN 10 session tests with a local Ed25519 JWKS (missing/non-Bearer 401 `auth.missing_token`; foreign key, expired, wrong issuer, `alg: none`, non-uuid `sub` 401 `auth.invalid_token`; no `NEON_AUTH_BASE_URL` 503 `auth.unavailable`).
- L4: T3 RED `Cannot find module './document.js'`; GREEN 4 OpenAPI tests. dependency-cruiser probed with temporary violating files: `routes-not-to-repositories` and `no-foreign-repositories` fire, a module's own repository is allowed. `openapi.json` excluded from Biome (generated). Totals: 39 API tests, lint, typecheck, build, audit high clean.
