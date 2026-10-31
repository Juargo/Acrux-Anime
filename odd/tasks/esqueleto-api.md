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
| T1 | S1, S3, S4, S5, S10 | inline | pending | container, modules, route definitions, request id, logger, problem errors |
| T2 | S2, S8, S9 | inline | pending | session middleware with `jose`, tests with a local JWKS |
| T3 | S6, S7 | inline | pending | OpenAPI emit/check, dependency-cruiser, CI steps |

## Log

- L1 (2026-10-31, stakeholder): "si" to starting #23 with JWT verification tested against local keys and connected to Neon Auth in #28.
