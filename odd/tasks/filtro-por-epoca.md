# Feature: catalog filter by era and franchise release year

Objective: the catalog page filters by the year each franchise first released, picked as several years grouped by era and decade, and each year shows the real number of franchises it holds.
Branch: `feat/filtro-por-epoca` · Delivery: `ask-on-risk` (forecast about 1100 authored lines; one commit per task so the slices can become chained pull requests) · Test runners: vitest in `apps/api` (repository tests need Docker, Testcontainers) and in `apps/web`.

## Specs

- S1 (user): "quiero que implementemos esta funcionalidad de filtrado de series" with the prototype https://claude.ai/artifact/Diar3aa3iBvxs3LhV43Kma. The prototype has:
  - Eras, in this order: `Pioneros` 1917–1959, `Era Tezuka` 1960–1979, `Boom OVA` 1980–1994, `Edad de oro` 1995–2005, `Era digital` 2006–2014, `Streaming` 2015–`hoy` (the current year, computed at run time).
  - One era open at a time. Clicking an era chip opens its panel; clicking it again closes it. The era chip has `aria-expanded` when open, `aria-pressed` when any of its years is selected, and a badge with how many of its years are selected.
  - The panel title is the era and its range ("Streaming · 2015 – hoy"). Its years are one row per decade, labelled "2010s", "2020s". Each year is a toggle chip (`aria-pressed`); several years can be selected, across eras.
  - Panel actions: "Todos" selects every year of the open era, "Ninguno" deselects every year of the open era, "Limpiar filtro" deselects every year of every era.
  - The current year has a dot marker.
  - No year selected shows every year.
- S2 (user): "la 2, conteo real del catálogo". Each year chip shows the real number of franchises of the catalog for that year, in compact form (for example "1.2k"). A year with none shows no number; a year with some has the accent border of the prototype.
- S3 (user): "El conteo será por franquicia si no por el lanzamiento de la temporada. Eso será otra página más adelante. Esta página será excluisva para visualizar los animes por decada de lanzamiento de franquicia." The year of a franchise is the year its oldest core entry started. Both the count and the grid use it: selecting 2016 shows the franchises that first released in 2016, and a later season never puts an older franchise under its own year.
- S4 (assumption, told to the user, not objected): the era panel lives on the catalog screen and replaces the year `select` of the filter sheet; genre and format stay in the sheet.
- S5 (assumption, told to the user, not objected): a search by name still covers every year (ADR-0017). While searching, the selected years are not sent, the year chips are disabled and the existing hint "La búsqueda cubre todos los años." shows.
- S6 (design, assumption): the API contract.
  - `GET /api/v1/catalog/anime` takes `years`: 1 to 150 distinct years, separated by commas, each between 1900 and 2100. It keeps the anime whose franchise first released in one of them. `year` (the anime's own year) stays as it is for clients already deployed (ADR-0022: expand, then contract); `year` and `years` together answer 400 `catalog.invalid_query`. Without either, every year.
  - `GET /api/v1/catalog/franchise-years` answers `{ "years": [{ "year": 2016, "franchises": 123 }] }`, oldest year first, only years with at least one franchise, adult titles never counted, same `Cache-Control` as the other catalog routes.
- S7 (design, assumption): the franchise of each anime is stored, not computed per request. `anime.franchise_root_id` and `anime.franchise_year` (both nullable, `franchise_year` indexed) hold the root and first year of the franchise the anime belongs to, as core entry or as extra. They come from `groupFranchises` of `@acrux/domain` with the curator overrides, the same grouping the browser does, so counts and grid agree. First year = the lowest year among the core entries, from `startDate`, else from `year`. Music videos and adult titles get null. A recompute step fills them after each run of the catalog load job and through its own script; between runs they can be up to a week behind new relations or curator edits.
- S8 (docs): ADR-0017 is accepted and not rewritten: a new ADR records browsing by franchise first year, several years and no default year, and marks what it replaces in ADR-0017. RF-13 and `docs/criterios/RF-13.feature` follow.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S3, S6, S7 | delegated (parallel writer: API unit, disjoint from T2), finished inline | done | `81f9440`. API suite 503 tests green (Testcontainers), typecheck, openapi:check, depcruise. Risk: items 1 and 5; independent verifier, no blockers (L7) |
| T2 | S1, S2, S4, S5 | delegated (parallel writer: web unit, disjoint from T1) | done | `ae049b3`. RED observed for `EraFilter` and `CatalogScreen`; web suite 443 tests, e2e support 13 tests, typecheck and build green. Not seen in a browser (L8) |
| T3 | S8 | inline | done | `3b00d33`. ADR-0045, ADR-0017 status, ADR index, RF-13 and its criterion; runbook line in `81f9440` |

Route evidence: T1 (migration, recompute, two routes; `apps/api`) and T2 (filter component, screen, client, i18n, e2e support; `apps/web`, `packages/i18n`, `apps/e2e`) are independent units of several files and well over 100 lines each, joined only by the S6 contract, so they are written in parallel. T3 is small and inline.

Risk: T1 names item 1 (migration and stored data) and item 5 (the load job script); it gets its own commit and an independent verifier.

## Log

- L1 (2026-11-19, user): "quiero que implementemos esta funcionalidad de filtrado de series [Image #2] https://claude.ai/artifact/Diar3aa3iBvxs3LhV43Kma"
- L2 (2026-11-19, user, answering what the number on each year should show): "la 2, conteo real del catálogo. El conteo será por franquicia si no por el lanzamiento de la temporada. Eso será otra página más adelante. Esta página será excluisva para visualizar los animes por decada de lanzamiento de franquicia."
- L3 (2026-11-19): mapping. The `anime` table stores no franchise; the browser groups each page with `groupFranchises` (packages/domain/src/franchise/grouping.ts), whose root is the curator pin or else the oldest core entry, so the first year is the minimum over the core, not the root's year. Relations are also written on request paths (`saveDetailed`), and the `acrux_catalog` role of the load job cannot read `franchise_override`, so the migration grants it. Receipt-driven development is off (global).
- L4 (2026-11-19): the Engram tools are not available in this session; the mirror `odd/filtro-por-epoca/tasks` is pending.
- L5 (2026-11-19): production needs one run of the recompute after the migration deploys; until then `franchise_year` is null everywhere and a year selection shows nothing. Running it against production is the user's decision.
- L6 (2026-11-19): the API writer came back partial. `apps/api` could not import `@acrux/domain`: no dependency, and the domain's extensionless imports fail under NodeNext (TS2835). Fixed inline: `.js` extensions on the seven relative imports of `packages/domain/src`, `@acrux/domain` as a workspace devDependency of `apps/api`, and the grouping passed in from the scripts (`scripts/franchises.ts`), so the compiled API still never loads the domain. `src/db/migrations.test.ts` pinned that `acrux_catalog` reads nothing but `anime`; it now pins that it reads `franchise_override` and cannot change it. The writer did not observe RED for the routes and the repository. One test added with the real grouping (curator pin, extra, music video).
- L7 (2026-11-19): independent verifier at `81f9440` against `aeaf56f`, in a scratch copy with its own Postgres container: S1 to S8 pass, no blockers. Migration applied over a populated previous schema left rows intact; the privilege diff shows only the two new columns, SELECT on `franchise_override` for `acrux_catalog` and its policy. `catalog:franchises` as `acrux_catalog`: first run changed 15 of 16 seeded rows as S7 says, second run changed 0 with the same data hash. 19 baseline requests answer the same status and body. Advisories recorded, not fixed: only the Streaming decade rows are pinned by a test; a row that turns adult keeps its old franchise values (never served); era chips are also disabled while searching; `catalog:franchises` has no guard on which database `DATABASE_URL` points to.
- L8 (2026-11-19): not verified: the screen in a browser, and Playwright. Locally the e2e API answers 503 `auth.unavailable` on `/api/v1/me` (no auth environment), so the suite fails before reaching the catalog; the CI e2e job is the place. `catalog:load` itself was not run (it needs a MyAnimeList client id); the recompute it ends with was.
- Next: pull request(s), then after the migration deploys one run of `catalog:franchises` in production (L5). Both are the user's decision.
