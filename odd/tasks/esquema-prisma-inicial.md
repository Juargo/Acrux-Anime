# Feature: initial Prisma schema, RLS and least-privilege role (issue #22)

Objective: create the `public` schema of ADR-0022 with Prisma in `apps/api`, RLS enabled on every table, and a runtime role `acrux_api` limited to DML; wire Neon connections per environment.
Branch: `feat/esquema-prisma-inicial` · Delivery: `ask-on-risk` · Test runner: Vitest against Postgres 17 in Docker (testcontainers).

## Specs

- S1 (issue #22): "Modelos `profile`, `mark`, `anilist_link`, `entitlement`, `billing_event`, `franchise_override`" (columns per ADR-0022 table).
- S2 (issue #22): "Migración que activa RLS en todas las tablas de `public`, sin políticas".
- S3 (issue #22): "Rol `acrux_api` con solo DML sobre `public`; migraciones con el rol propietario solo desde CI".
- S4 (issue #22): "Conexión con pooler de Neon (`DATABASE_URL`, runtime) y directa (`DATABASE_URL_UNPOOLED`, migraciones)".
- S5 (issue #22): "`list_visibility` con valor por defecto `private` (ADR-0028)".
- S6 (issue #22): "`DATABASE_URL` y `DATABASE_URL_UNPOOLED` en el proyecto `app` de Vercel: producción con la rama `production` de Neon y vistas previas con la rama `dev` (viene de #21)".
- S7 (acceptance): "Con la clave anónima no se puede leer ni escribir ninguna tabla de `public`". Neon has no anonymous key and the Data API is off (`neon.ts`); verified as: a role without grants cannot read or write any `public` table.
- S8 (acceptance): "La PK `(user_id, anilist_id)` impide marcas duplicadas".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S2, S3, S5, S7, S8 | inline | done (cc42087) | Prisma 7 schema + migration (tables, RLS, `acrux_api` grants), integration tests on Postgres 17 |
| T2 | S4 | inline | done (cc42087) | `prisma.config.ts` with the direct URL for migrations; docs for env vars |
| T3 | S3, S6 | remote (needs authorization) | pending | `acrux_api` login + password on Neon `production` and `dev`, migration applied, Vercel env vars |

## Log

- L1 (2026-10-31, stakeholder): "si" to starting #22 after closing #21.
- L2: `neon_auth.user.id` is `uuid` per Neon's Supabase migration guide (to confirm in #28). Prisma `latest` is 8.0.0-rc.29, so the stable 7.10.1 is used.
- L3 (design): Postgres applies RLS to every role that is not the table owner, so a policy-less table also blocks `acrux_api`. Roles created with the Neon API join `neon_superuser` (not least privilege), so `acrux_api` is created in SQL. Chosen: the migration creates `acrux_api` as `NOLOGIN` if missing, grants it DML on the app tables and adds one permissive policy per table **only for `acrux_api`**. Any other non-owner role (as the Data API roles would be) has no grants and no policy. Login and password are set per Neon branch outside the repo (T3).
- L4: T1–T2 in cc42087. RED: `Could not find Prisma Schema`; GREEN: 14 integration tests on Postgres 17 (testcontainers). Lint, typecheck, all tests (35), build pass; audit high clean. New allowBuilds: @prisma/engines and prisma true; cpu-features, ssh2, protobufjs false.
