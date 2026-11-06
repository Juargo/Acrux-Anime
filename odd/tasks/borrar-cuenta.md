# Feature: account deletion and data export (issue #38)

Objective: a signed-in user downloads their data as JSON and deletes their account after typing BORRAR: the API deletes every `public` row, then the Neon Auth user, then the PostHog person.
Branch: `feat/borrar-cuenta` · Delivery: `single-pr` · Test runner: vitest (`apps/api` with supertest and Testcontainers, `apps/web` with Testing Library on jsdom).

## Specs

- S1 (issue #38): "`DELETE /api/v1/me`: transacción que borra los datos de `public`, luego el usuario de Neon Auth con la API administrativa de Neon (credencial solo en el servidor, ADR-0034) y la persona en PostHog".
- S2 (issue #38): "`GET /api/v1/me/export` en JSON". ADR-0028: export as JSON.
- S3 (issue #38): "Confirmación en la UI antes de borrar". Figma M19 "Borrar tu cuenta": "Se borra para siempre: tu perfil, tus marcas, tu enlace público y tu plan.", "No se toca: tu lista de AniList.", "Las tarjetas que ya compartiste no se pueden recuperar.", "Descargar mis datos antes", "Escribe BORRAR para confirmar", "Borrar mi cuenta para siempre".
- S4 (issue #38): "Evento `account_deleted`". ADR-0030: properties never include personal data.
- S5 (issue #38): "Pruebas de integración del borrado y de la exportación".
- S6 (acceptance, issue #38): "Cuando borro mi cuenta y lo confirmo / Entonces se eliminan mi perfil, mis marcas y mi vínculo con AniList / Y ya no puedo iniciar sesión con esos datos / Y mi cuenta de AniList no cambia".
- S7 (RF-06): "Si la sesión tiene más de 24 horas, debe volver a iniciar sesión antes."

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S2, S5, S6 | inline | done | `d533499`: `DELETE /api/v1/me` (profile delete in a transaction with cascade, then Neon Auth admin, then PostHog `bulk_delete`; 502 `account.auth_unavailable` on a Neon failure, idempotent retry; 503 `account.unavailable` without Neon credentials) and `GET /api/v1/me/export`. RED (repository `remove`, adapters, HTTP integration 7 tests), GREEN; API 252, typecheck, depcruise, `openapi:check`. Risk: items 1 (irreversible deletion) and 2 (new server credentials) |
| T2 | S3, S4, S7 | inline | done | `5b352f4`: Perfil rows "Descargar mis datos" and "Borrar cuenta", M19 screen at `/perfil/borrar-cuenta` (BORRAR, 24h re-auth with `session.createdAt`), `account_deleted` after `forget()`, sign-in notice "Borramos tu cuenta y tus datos.", no `/me` after deletion. RED 6 + 2 + 2, GREEN; web 247, typecheck, build. Risk: item 1 |
| T3 | S1–S7 | inline | done | `729cab4`: `docs/runbooks/borrado-de-cuenta.md`, `analitica.md` (`account_deleted`), ADR-0034 (admin API confirmed), API README variables. Risk: none |

Route evidence: one feature in dependent deliveries (the API, then the app that calls it); no writer trigger holds.

## Log

- L1 (2026-11-05, stakeholder): "continuemos", then chose "#38 Account deletion (Recommended)".
- L2 (2026-11-05, research): The Neon API deletes an auth user with `DELETE https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}/auth/users/{auth_user_id}` and a Neon API key; it cannot be undone and is not safe to retry blindly. PostHog deletes persons with `POST /api/projects/{project_id}/persons/bulk_delete/` and `distinct_ids`, using a personal API key with `person:write`; PostHog processes the deletion asynchronously and advises against reusing a deleted distinct_id.
- L3 (2026-11-05, assumptions):
  - Order: one `DELETE` of the profile row (the cascade removes marks, the AniList link and the entitlement atomically), then Neon Auth, then PostHog.
  - The route is idempotent, so a retry after a Neon failure finishes the job. A 404 from Neon counts as already deleted.
  - Without the Neon credentials (`NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID`) the route answers 503 and deletes nothing.
  - Without the PostHog credentials or `ANALYTICS_ID_SECRET`, the PostHog step is skipped. A PostHog failure goes to Sentry and the deletion still succeeds.
  - `account_deleted` is sent anonymously after `forget()`, so no person is recreated.
  - The 24h check (S7) runs in the app with Neon Auth's `session.createdAt`, because the API's JWT carries no session age (to confirm on the preview).
  - The Plus box of M19 waits for #50, because no plan exists yet.
  - Perfil gets "Descargar mis datos" and "Borrar cuenta" rows.
- L4 (2026-11-05): T1–T3 done on `feat/borrar-cuenta`. The export carries the profile and the marks only: the AniList link and the plan have no service yet (#40, #50), so their tables are empty in the beta. The service in T1 was written just before its unit tests; the HTTP integration tests were RED first.
- L5 (2026-11-05): independent verifier on `a41ee5c..HEAD`: no blockers. S1–S6 pass; S7 is partly verified: the logic is tested, but whether Neon Auth returns `session.createdAt` must be confirmed on the preview (without it the check fails open), and the check is client-side only. Advisories:
  - Fixed: the 503 text now fits the export as well.
  - Fixed: the runbook notes that a valid JWT recreates an empty profile after a 502 until the retry.
  - Recorded: no App test pins "no `/me` after deletion".
  - Recorded: a failed Google sign-in can leave the spinner.
  - Checks: API 252, web 247, typecheck, depcruise, `openapi:check`.
