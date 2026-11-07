# Curator corrections table and curator role (#42)

Objective: the API serves the curator table (`franchise_override`) to every signed-in user and lets only the `curator` role edit it; the web applies the corrections when grouping and offers a minimal `/curador` screen.
Branch: `feat/curador`. Delivery: single-pr (same as #43 and #47). Test runner: vitest (`pnpm --filter @acrux/api test`, `pnpm --filter @acrux/web test`), Playwright for the E2E journey.

## Specs

- **S1** (issue #42): "Rol `curator` del usuario de Neon Auth (asignado con `neon neon-auth user set-role`) y `requireRole('curator')` (ADR-0034)".
- **S2** (issue #42): "Rutas de edición de `franchise_override`".
- **S3** (issue #42): "Carga inicial de correcciones de las sagas más populares". RF-60: "~200 sagas".
- **S4** (issue #42, stakeholder 2026-11-07): "Pantalla /curador (Recommended)": a minimal internal screen, visible only with the `curator` role, to add and change corrections by AniList ID.
- **S5** (issue #42, acceptance): "Un usuario sin rol curador recibe 403 al intentar editar".
- **S6** (RF-60, RDI-30): "La tabla del curador siempre prevalece." "Una corrección nunca resta al total de nadie." RDI-15: "IDs del agrupamiento corregido … sin títulos ni portadas".
- **S7** (ADR-0023): `GET /api/v1/franchise-overrides`; ADR-0024: the browser applies the corrections it fetches. Access changed to public in L4.
- Assumption A1: the role comes from the verified JWT `role` claim. Neon Auth sends `"role": "authenticated"` by default and `set-role` changes it (Neon docs, `content/docs/auth/guides/plugins/jwt.md`). Better Auth stores several roles comma-separated, so the claim is split on commas. A role change reaches the API when the 15-minute token is renewed.
- Assumption A2: there is no delete. Deleting a row would let automatic grouping put an entry back into a core with its old start date, which could undo a completed franchise (S6). To undo a correction, the curator sets another role, which moves `updatedAt` forward.
- Assumption A3: the web learns whether the user is a curator from `GET /api/v1/me` (a new optional field). The API is still the only gate.
- Assumption A4: S3's ~200 corrections are curation work for the stakeholder, done in the S4 screen. This PR ships the tool, not the data.

## Tasks

| ID | Specs | Task | Route | Status | Evidence |
|---|---|---|---|---|---|
| T1 | S1, S2, S5, S6, S7 | API: role in the session, `requireRole`, `GET/PUT /api/v1/franchise-overrides`, `curator` in `/me` | inline; Risk item 2 (auth) | done | f1ea137; RED 11 failing, GREEN API 271/271 |
| T2 | S6, S7 | Web: fetch the corrections and pass them to the three `groupFranchises` call sites | inline | done | f4d056c; RED 2 + missing module, GREEN web 322/322 |
| T3 | S4 | Web: `/curador` screen (list, add, change), es/en | inline | done | 3ff14c4; RED 6/6, GREEN web 328/328 |
| T4 | S1, S3, S5 | Runbook (assign the role, curate), criteria tags, E2E 403 journey | inline | done | E2E 10/10 (chromium + webkit) on fresh Postgres; check-tags 21 of 52 |

## Log

- **L1** (2026-11-07, stakeholder): "¿Arrancamos con la #42?" → "si".
- **L2** (2026-11-07): map. The table and enum already exist (`20261031000000_esquema_inicial`). `groupFranchises` uses `updatedAt` as the `joinedAt` floor (RF-60). Three web call sites pass `[]`: `anilist/franchise.ts:141`, `catalog/items.ts:90`, `counter/use-marked-franchises.ts:99`. The session reads only `sub`, `name`, `image`; there is no `requireRole`.
- **L3** (2026-11-07, stakeholder): editing through "Pantalla /curador (Recommended)".
- **L4** (2026-11-07): `GET /api/v1/franchise-overrides` is public, not Usuario. The public profile groups the owner's marks in the visitor's browser without a session, so a private table would group differently for visitors. The table holds only AniList ids (RDI-15). It uses the public rate limit and `s-maxage=300`. ADR-0023 and ADR-0025 updated.
- **L5** (2026-11-07): known limit. A correction applies only when both ids are already in the crawled set. The crawl follows SEQUEL/PREQUEL from the seed, so a `core` correction for an entry with no AniList relation to the saga is not fetched. Corrections of related entries (OVAs, movies, side stories) work.
- **L6** (2026-11-07): T4. The E2E fake Neon Auth now signs `role` ("authenticated" by default). The curator journey uses a new saga (Spy x Family) because a correction stays in the shared database. `docs/runbooks/curaduria.md` explains how to assign the role and curate. S3's initial load is left to the stakeholder (A4).
- **L7** (2026-11-07): independent verifier (Risk item 2): PASS, no blockers; API 271/271, web 328/328, tsc, openapi:check and lint clean. Its advisory "a public route with a role silently skips the check" is closed: createApp now refuses that combination (test in app.test.ts). Other advisories accepted: a 403 carries no Cache-Control (same as 401); a non-curator 403 does not use the write budget; no DB-level test of updatedAt moving forward on an identical re-save.
