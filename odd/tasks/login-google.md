# Feature: Google sign-in with Neon Auth and profile creation (issue #28)

Objective: a tester signs in with Google, enters the app with their Google name and avatar and a private list, and signing out leaves no access to their data.
Branch: `feat/login-google` · Delivery: `single-pr`, as #26 and #27 · Test runner: vitest in `apps/api` (testcontainers Postgres) and `apps/web`; preview proof, including Safari on iPhone.

## Specs

- S1 (issue #28): "Activar Neon Auth en `neon.ts` y configurar Google con credenciales propias, con `app.acruxanime.com` y las vistas previas como dominios de confianza".
- S2 (issue #28): "`signIn.social({ provider: 'google' })` del cliente de Neon Auth en la SPA y cierre de sesión".
- S3 (issue #28): "Crear `profile` en el primer ingreso (lista privada, conteo por franquicia)".
- S4 (issue #28): "`GET /api/v1/me`".
- S5 (issue #28): "Pantalla de consentimiento de Google publicada con la política de privacidad".
- S6 (issue #28): "Agregar el origen de Neon Auth a `connect-src` de la CSP en `apps/web/vercel.json` (viene de #21)".
- S7 (acceptance, @CA-RF01-01): "Dado que no tengo cuenta en Acrux / Cuando inicio sesión con mi cuenta de Google / Entonces entro a la app con mi nombre y avatar de Google / Y mi lista es privada por defecto".
- S8 (acceptance, @CA-RF05-01): "Dado que inicié sesión / Cuando cierro sesión / Entonces vuelvo a la pantalla de ingreso y no puedo ver mis datos sin volver a entrar".
- From the issue context: "Del perfil de Google se toman el nombre y el avatar; el correo no se muestra nunca."

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S3 | inline | done | Prisma with `@prisma/adapter-pg`, profile repository tested as `acrux_api` against the real migrations, `prisma generate` before build, typecheck and test. Risk: item 5 |
| T2 | S3, S4, S7 | inline | done | `name` and `image` claims (https only, never the email), issuer defaults to the Auth origin, `GET /api/v1/me` with 503 without a database; RED then GREEN, 83 API tests. Risk: item 2 |
| T3 | S2, S6, S7, S8 | inline | written | sign-in screen from Figma M01/D01 without the age checkbox, `@neon/auth` session, `GET /api/v1/me`, sign-out; 8 web tests, build, visual check at 390 and 1440 px. CSP waits for the Auth origin (T4). Risk: item 2 |
| T4 | S1, S5 | stakeholder (secrets) | pending | Google OAuth client and consent screen, Neon Auth on the `production` branch, provider, trusted domains, Vercel variables |
| T5 | S1-S8 | inline | done | ADR-0034 note, runbook `docs/runbooks/inicio-de-sesion.md`, CSP origin |
| T6 | S7, S8 | after setup | pending | preview proof, desktop and Safari on iPhone |

## Log

- L1 (2026-11-02, stakeholder): "continuemos con #28".
- L2 (2026-11-02, stakeholder): "no incluyamos eso", about the "Tengo 16 años o más" checkbox of Figma M01/D01 (RF-09, P-07 stays open).
- L3 (2026-11-02): research. The current SDK is `@neon/auth` (0.8.x); the `@neondatabase/*` packages are legacy betas. `neon.ts` only takes `auth: true`; Google, its credentials and trusted domains are set per Neon branch in the console, CLI or API. The JWT is EdDSA, lasts 15 minutes and carries `name`, `email`, `image` and `role`; its issuer is the origin of `NEON_AUTH_BASE_URL`, not the full URL the API compares today. Whether `sub` is a UUID is unverified. Calling Neon Auth directly from the SPA relies on cross-site cookies, which Safari may block; the alternative is a same-origin proxy at `/api/auth/*`, with a beta Express adapter.
- L4 (2026-11-02, stakeholder): "vamos con A": the SPA talks to Neon Auth directly; a Safari test on iPhone decides whether a same-origin proxy is needed before closing #28.
- L5 (assumptions): one Neon Auth on the `production` branch serves production and previews, so there is one Auth origin in the CSP. Previews use an exact trusted domain, the Vercel branch alias of `feat/login-google`, not `*.vercel.app`, which would let any Vercel site receive the session verifier. The profile is created by `GET /api/v1/me` on the first request, from the `name` and `image` claims; the email is never stored in `profile` or returned. The API reaches Postgres with Prisma and `@prisma/adapter-pg`, because it can be tested against a local Postgres.
- L6 (2026-11-02): the first database access of the API. `createMany` with `skipDuplicates` makes concurrent first requests create one row, and a later sign-in never overwrites the stored name. The generated Prisma client has internal import cycles, so `src/generated/` is excluded from dependency-cruiser.
- L7 (2026-11-02): `@neon/auth` 0.8.0 is the only version out of the 7-day quarantine, and it pins `better-auth` 1.7.6, with a critical and a high advisory fixed in 1.7.7. A pnpm override pins the better-auth packages to 1.7.14 until `@neon/auth` 0.8.2 can be installed (after 2026-11-06). The public client has no `getJWTToken`; `getSession()` puts the JWT from `set-auth-jwt` in `session.token`. The SPA has no DOM test runner, so the screens are checked visually and in the preview proof.
- L8 (2026-11-02, stakeholder): Neon Auth enabled on `production`; Auth URL `https://ep-round-snow-b5mftgmf.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth`. Its origin is now in `connect-src`. The stakeholder pasted Neon's onboarding prompt (email and password sign-up, `npm install -g`, `neon init`); it was not run, because #28 and ADR-0015 are Google only.
