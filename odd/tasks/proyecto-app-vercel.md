# Feature: `app` project on Vercel (issue #21)

Objective: publish the SPA (`apps/web`, Vite + React) and the Express API (`apps/api`) in one Vercel project `app` on `app.acruxanime.com`, API under `/api`, functions in `gru1`, strict security headers.
Branch: `feat/proyecto-app-vercel` · Delivery: `ask-on-risk` · Test runner: Vitest (+ Supertest for the API).

## Specs

- S1 (issue #21): "Proyecto `app` con Vite como salida estática y Express como función bajo `/api`".
- S2 (issue #21): "Región de funciones `gru1`".
- S3 (issue #21): "`vercel.json` con CSP (`connect-src`: self, Neon Auth, `graphql.anilist.co`, PostHog, Sentry; `img-src`: CDN de AniList, avatares de Google, `data:`), HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`". Assumption: the Neon Auth and Sentry origins are not known until #28 and #26 create them; they are added to `connect-src` in those issues.
- S4 (issue #21): "Dominio `app.acruxanime.com`". The DNS record at GoDaddy is set by the stakeholder.
- S5 (issue #21): "Vistas previas por PR conectadas a una rama de Neon de desarrollo (ADR-0034)".
- S6 (acceptance): "securityheaders.com da A o superior".
- S7 (acceptance): "`/api/health` responde en producción y en las vistas previas".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S7 | inline | done (b981b02) | `apps/api` Express app with `GET /api/health`, Supertest test |
| T2 | S1 | inline | done (b981b02) | `apps/web` Vite + React + React Router shell |
| T3 | S1, S2, S3 | inline | done (b981b02, 062a9a4); verified on preview | Vercel function entry, `vercel.json` (rewrites, region, headers) |
| T4 | S1, S2, S7 | inline (remote, authorized) | done for preview; S5 moved to #22 | Vercel project `app`, preview deploy, `DATABASE_URL` per environment |
| T5 | S4, S6, S7 | stakeholder DNS + inline check | done | `app.acruxanime.com` live, securityheaders.com grade |

## Log

- L1 (2026-10-30, stakeholder): "Pasemos directamente al milestone 2." Then "si" to labelling #21–#24 and #27 as `sprint:4`, adding the dated note to ADR-0031 and starting with #21.
- L2: ADR-0031 note committed on `docs/h2-en-paralelo-a-la-validacion` (a81689b), not pushed yet.
- L3: Vercel zero-config Express takes a whole project; this feature uses the Vite preset with an `api/` function that imports the Express app from `@acrux/api` instead.
- L4: T1–T3 committed (b981b02). RED: `Cannot find module './app.js'`; GREEN: 2 Supertest tests. Lint, typecheck, test, build pass; `pnpm audit --audit-level=high` clean (2 moderate).
- L5: Review (risk, reliability) approved without corrections and acknowledged. Vercel project `app` created by the stakeholder (prj_BsyuzU8S56toVXFCgKcW4HOyeeo2, root `apps/web`, Vite preset); set Node 22.x and enabled Git deployments (the API creation left them disabled). `DATABASE_URL` per environment moves to #22, when the API first uses the database.
- L6: First preview returned 500 on /api: the function imported `@acrux/api` as untranspiled TS from the workspace. Fix 062a9a4: `@acrux/api` builds to `dist/app.js` (exports default → dist, types → src) and `vercel.json` builds `@acrux/web...`. Preview app-exa3a665h: `/api/health` 200 `{"status":"ok"}` with `x-vercel-id: gru1::gru1`, unknown API route 404 JSON, SPA fallback 200, all security headers present. The first deployment (fbc1638) was auto-marked production because the project had none; it has no domain.
- L7 (2026-10-31): PR #61 merged (f4d771d). `app.acruxanime.com` CNAME created by the stakeholder; `/api/health` 200 on the domain; securityheaders.com grade A+ (checked by the stakeholder). Issue #21 closed. S5 moved to #22; Sentry and Neon Auth CSP origins added as tasks to #26 and #28. Feature closed.
