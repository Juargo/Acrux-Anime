# Feature: total counter with the franchise / entry switch (issue #34)

Objective: a counter fixed at the top of the signed-in layout counts complete franchises by default or seen entries by choice, and the choice is saved in the profile.
Branch: `feat/contador-total` · Delivery: `single-pr` · Test runner: vitest (`apps/api` with supertest and Testcontainers, `apps/web` with Testing Library on jsdom).

## Specs

- S1 (issue #34): "Contador fijo arriba, calculado con `packages/domain`". RF-24: "Un contador total visible arriba se actualiza al marcar o desmarcar, desde la primera marca." RDI-32: "El contador por franquicias cuenta franquicias con todo el núcleo visto; el contador por entradas cuenta cada entrada vista, de cualquier formato." RNF-42: "El contador siempre coincide con la lista visible, y los cambios del catálogo nunca le restan (DD-03)." Figma M03 "Catálogo con contador" (28:122): "48 animes" / "sagas completas".
- S2 (issue #34): "Interruptor que guarda `counter_mode` en el perfil (`PATCH /api/v1/me`)". RF-25: "El contador cuenta **por franquicia** por defecto; un ajuste permite contar **por entradas**." Stakeholder decision L2: "En el contador (Recomendado)".
- S3 (issue #34): "Evento `counter_mode_changed`" (ADR-0030; no personal data).
- S4 (acceptance, @CA-RF25-01): "Dado que vi una franquicia completa de 4 entradas y mi contador muestra 1 / Cuando cambio el interruptor a "por entradas" / Entonces el contador muestra 4 / Y la preferencia se mantiene al volver a entrar".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S2 | inline | done | `0e6a4e9`: `PATCH /api/v1/me` with a strict `{counterMode}` body, profile created first if missing, `Cache-Control: private, no-store`, 400 `profile.invalid_body`, 503 without a database; OpenAPI regenerated; runbook updated. RED 6 route tests, then GREEN; api 142 tests (repository on Testcontainers). Risk: none (a new route) |
| T2 | S1–S4 | inline | done | `counter/` (TotalCounter container, CounterView, useTotalCounter), `crawlFranchises` sharing the crawl of `fetchFranchise`, `useMarks` shared by the catalog and the counter, `saveCounterMode`, counter in the sticky bar of Home in place of the logo (Figma M03), `docs/criterios/RF-25.feature`. RED then GREEN: 3 client, 2 crawl, 5 counter tests incl. `@CA-RF25-01`; web 97, typecheck, lint, build green. Risk: item 3 (shared crawl of `fetchFranchise` and the marks query) |

Route evidence: one feature in two dependent deliveries (API, then SPA); no writer trigger holds (not parallel, parent context fresh).

## Log

- L1 (2026-11-03, stakeholder): "sigamos con #34".
- L2 (2026-11-03, stakeholder): "En el contador (Recomendado)" — the switch sits next to the counter, since the Perfil y ajustes screen (M16, "Contar por · Franquicias") does not exist yet; its row will reuse the same PATCH.
- L3 (2026-11-03, assumptions): `PATCH /api/v1/me` accepts only `counterMode` for now (strict body; the other ADR-0023 fields arrive with #37, #39 and #43) and returns the profile. The franchise counter needs the franchises of every seen mark, so the SPA crawls AniList from the seen ids in `id_in` batches (the crawl of `fetchFranchise`), caches what it fetched and only crawls ids it does not know yet. Labels: "N animes" with "sagas completas" or "entradas vistas" (Figma M12); the switch is a two-option control "Franquicias" / "Entradas". The event is a typed callback, as `franchise_marked` (PostHog in the SPA arrives with #46). A failed PATCH rolls the switch back and says so.
- L4 (2026-11-03): T2 notes. The counter replaces the logo in the bar, as in M03. By franchise it shows "— animes" until the first crawl lands; an entry marked meanwhile counts once its franchise is crawled (one more AniList batch). A crawl that reaches the 20-request bound keeps the ids it could not follow and continues from them on the next render, so a long chain never stops half way. The event callback is not wired to a sender yet, as `franchise_marked` (#46).
