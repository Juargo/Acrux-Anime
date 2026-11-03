# Feature: catalog exploration (issue #31)

Objective: the signed-in home is the catalog: search by name or browse by release year, filter by genre and format on AniList, one item per franchise in a virtualized grid, seen franchises dimmed, clear loading, empty, error and offline states.
Branch: `feat/exploracion-catalogo` · Delivery: `single-pr` · Test runner: vitest in `apps/web` (Testing Library on jsdom for components).

## Specs

- S1 (issue #31): "Búsqueda por nombre". RF-12: "El usuario puede buscar por nombre."
- S2 (issue #31): "Exploración por año de estreno (año en curso por defecto, retroceso hasta 1917)". ADR-0017: "del año actual hacia atrás hasta 1917, con el año actual seleccionado por defecto; el año actual se calcula en tiempo de ejecución".
- S3 (issue #31): "Filtros de género y tipo resueltos por AniList (`genre_in`, `format_in`)". RF-13: "El usuario puede filtrar por año, género y tipo." RF-11: "El catálogo incluye series de TV, películas, OVAs, ONAs y especiales. Se excluye el contenido adulto y las entradas de música."
- S4 (issue #31): "Lista virtualizada (TanStack Virtual) con portada y título". RF-14: "Cada anime aparece como **un solo ítem por franquicia** que agrupa sus temporadas, películas y demás entradas." RF-17: "Los títulos se muestran en inglés si existen y, si no, en romaji".
- S5 (issue #31): "Ítems vistos atenuados (RF-23)". RF-23: "Una franquicia vista se muestra atenuada en el catálogo."
- S6 (issue #31): "Estados de carga, vacío, error y sin conexión (RNF-21)". RNF-21: "Sin conexión, o si AniList no responde o limita las peticiones, la app lo informa con un mensaje claro y no pierde lo marcado."
- S7 (acceptance, @CA-RF12-01): "Dado que inicié sesión / Cuando busco "frieren" / Entonces veo un solo ítem por franquicia con portada y título".
- S8 (acceptance, @CA-RF13-01): "Dado que exploro los estrenos de 2023 / Cuando filtro por género "Fantasy" y tipo "TV" / Entonces solo veo franquicias que cumplen los tres criterios".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S2, S3, S4 | inline | done | `anilist/catalog.ts` (CATALOG_PAGE with one-hop relations, GENRES, Zod), `catalog/items.ts` (one item per franchise through `groupFranchises`); RED (modules missing), GREEN 15 tests; live check against AniList: "frieren" → 6 hits, 2 items; 2023 + Fantasy + TV → 50 hits, 49 items, next page. Risk: item 5 |
| T2 | S1–S8 | inline | done | `CatalogScreen` (container), `CatalogGrid` (TanStack Virtual window grid, 3/4/6 columns), `FilterSheet` (draft applied on "Ver resultados"), home now renders the catalog; RED (module missing), GREEN 10 screen tests incl. `@CA-RF12-01`, `@CA-RF13-01`; web suite 52 tests, typecheck and build green |

Route evidence: one screen whose UI depends on the query layer; no independent parallel units and no writer reason; inline.

## Log

- L1 (2026-11-03, stakeholder): "si" (start #31 after #30 merged).
- L2 (2026-11-03, stakeholder decision): "Agrupar con la consulta". The catalog query brings each hit's relations one hop away, with no extra requests; hits of one saga collapse into one item titled and covered by the earliest known entry; the franchise detail (#32) builds the full franchise.
- L3 (2026-11-03, assumptions proposed to the stakeholder, not objected): default view is the current year (ADR-0017; RF-10's popular burst waits for P-06); by year means entries whose `seasonYear` is that year, and genre/format filter the entries on AniList, so a franchise shows when one of its entries matches (Figma M34: "Una saga aparece si alguna de sus entradas cumple el filtro."); sort by popularity; pages of 50 with infinite scroll; search with no minimum length and a 300 ms debounce; titles English, else romaji; dimming wired through `franchiseProgress` with an empty marks source until `GET /api/v1/me/marks` exists (#33/#35); no curator overrides until `GET /api/v1/franchise-overrides` exists (#42); the catalog replaces the placeholder home at `/`.
- L4 (2026-11-03): Figma "Acrux · Diseño de producto" M03 (28:122) and D03 (32:652) show a grid of covers with title, entry count and state badges, a counter header and a bottom bar; M34 (49:3894) and D36 (49:3998) show a filter sheet with year ranges (2026, 2025, 2020–2024, 2010–2019, Antes de 2010). Built here: the grid, the search box and the Año/Género/Tipo chips. Following the issue and ADR-0017, the year is a single-year selector back to 1917, not Figma's ranges. Left out, owned elsewhere: counter header (#34), state badges and progress (#33), bottom bar (later screens). Entry counts are left out because the one-hop data cannot count a franchise's entries.
- L5 (2026-11-03): `@tanstack/react-virtual` latest (3.14.26) is younger than the 7-day pnpm quarantine; 3.14.23 (2026-10-26) is used. `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.8, `jsdom` 30.1.3 are past it.
- L6 (2026-11-03): found while writing T2: TanStack Query v5 sets `isError` when a later page fails, so the whole grid gave way to the first-load error; the screen now uses `isLoadingError` for the full-page error and keeps the grid with an inline retry for a failed page (RED, then GREEN). Not checked in a browser: the signed-in screen needs Neon Auth; the Vercel preview is the place to look at it. Covers use `coverImage.large`, served from s4.anilist.co, which the CSP already allows.
- L7 (2026-11-03): independent verifier (Risk item 5) at `4de33cd`: no blockers; S1–S8 pass. Item 5: all 56 new lockfile entries predate the 7-day quarantine (newest `@tanstack/react-virtual` 3.14.23 and `@tanstack/virtual-core` 3.19.8, 2026-10-26); no dev packages in the bundle. Live check (3 requests): 2023 + Fantasy + TV pages 1–2 gave 88 items with no duplicate roots and stable order; 29 of 88 items take title and cover from an earlier entry outside the filter, as L2/L3 accept. Fixed from the advisories (RED, then GREEN): focus moves into the filter sheet and back to its chip; the year is disabled while searching, with "La búsqueda cubre todos los años."; the search is trimmed before the query key; the next-page error hides while that page is retried. Recorded, not fixed: no Tab focus trap in the sheet; the bundle grows by 87 kB (25 kB gzip), mostly zod, which the catalog is the first to use; "Limpiar" applies at once. Web suite 54 tests.
- L8 (2026-11-03, stakeholder): "Omitir esta vez" for the native review of the commits against main (15 files, 2021 lines, medium risk from `apps/web/package.json`); declined for this candidate only.
