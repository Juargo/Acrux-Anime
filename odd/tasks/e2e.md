# E2E smoke suite and acceptance criteria (#47)

Objective: Gherkin criteria for the Must stories, a tag check, and a Playwright smoke suite that runs on every PR against the app built locally in CI.
Branch: `feat/e2e`. Delivery: single-pr (same as #43, to confirm when it crosses 400 lines). Test runner: Playwright (`pnpm --filter @acrux/e2e e2e`), vitest for the tag script.

## Specs

- **S1** (issue #47): "`docs/criterios/*.feature` con los escenarios de las historias Must" (H2 Must stories without a file today: RF-01, RF-05, RF-06, RF-08, RF-09, RF-10–RF-14, RF-21–RF-24, RF-28, RF-31, RF-33, RF-35, RF-41, RF-43, RF-60, RF-70, RF-73, RF-74; plus RF-71, already in #43). Format per ADR-0029: `# language: es`, `@CA-<requisito>-<nn>` per scenario, no Cucumber.
- **S2** (issue #47): "Script de CI que avisa si un `@CA-…` no aparece en ninguna prueba". ADR-0029: a warning, not a failure. Only test files count as tests.
- **S3** (stakeholder, 2026-11-07, replaces "Playwright contra la vista previa del PR"): "App local en CI (Recommended)". CI builds the web and the API and runs them with Postgres in a container. Neon Auth is simulated: the API verifies JWTs signed with a test key, and Playwright intercepts Neon Auth and AniList. No secrets, no production, works on fork PRs. Phone viewport, Chromium and WebKit (ADR-0029). ADR-0027 and ADR-0029 are updated by a new ADR.
- **S4** (issue #47): "AniList interceptado con `page.route()`".
- **S5** (issue #47): "Recorridos: buscar → marcar → contador → compartir; borrado de cuenta; perfil privado".
- **S6** (issue #47, acceptance): "La suite corre en cada PR y bloquea la fusión si falla". Making the new check required on `main` is a repository setting the stakeholder changes.
- Assumption: the Playwright package lives in `apps/e2e`, with a script named `e2e` (not `test`), so the Quality job's `pnpm test` does not run it.

## Tasks

| ID | Specs | Task | Route | Status | Evidence |
|---|---|---|---|---|---|
| T1 | S3 | ADR-0037: E2E against the app built in CI, simulated Neon Auth; updates ADR-0027 and ADR-0029 | inline | done | ee35dab |
| T2 | S1 | `.feature` files for the Must H2 stories without one | delegated (parallel with T4) | done | 25 files, no duplicate tags (structural check) |
| T3 | S2 | Tag check script + CI step (warning); normalize existing tags (`@CA-RF06`, `CA-RF71-01`, `// @CA-ADR16-01`) | inline; Risk item 5 (CI) | done | RED: module missing; GREEN: 5/5; real run 16 of 51 criteria tested |
| T4 | S3, S4 | `apps/e2e` harness: Playwright, test JWKS, API + Postgres, built web, Neon Auth and AniList routes | inline; Risk item 5 (dependency, CI) | pending | — |
| T5 | S5, S6 | Journeys and the `E2E` CI job | inline; Risk item 5 (CI) | pending | — |

## Log

- **L1** (2026-11-07, stakeholder): "¿Arrancamos con #47?" → "si".
- **L2** (2026-11-07): map. Previews share the production Neon Auth instance (`docs/runbooks/inicio-de-sesion.md`), sign-in is Google only, dynamic preview origins are not trusted domains, and the CSP only allows the production Neon Auth host. The API verifies JWTs against `<NEON_AUTH_BASE_URL>/.well-known/jwks.json` (`apps/api/src/http/session.ts:59-63`), so a local JWKS server works without code changes. AniList is called from the browser at `https://graphql.anilist.co` (`apps/web/src/anilist/client.ts:5`). Existing tests cite tags as the first word of the `it()` title.
- **L3** (2026-11-07, stakeholder): environment "App local en CI (Recommended)".
- **L4** (2026-11-07): T2 kept the meaning of tags tests already used. `DeleteAccountScreen.test.tsx` cited `@CA-RF06`, which is now `@CA-RF06-02` (re-sign-in after 24 h). The RF-71 test title now starts with `@CA-RF71-01`. `CA-ADR16-01` (issue #44) is not a requirement in docs/criterios, so it stays a plain comment.
- **L5** (2026-11-07): T3. `apps/e2e/scripts/check-ca-tags.ts` scans `*.test.*` and `*.spec.*` under apps/ and packages/ and prints GitHub `::warning` annotations; it always exits 0. Its own test builds tags at runtime, so fixture tags never count. It runs as a Quality step.
