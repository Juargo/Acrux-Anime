# Feature: franchise detail (issue #32)

Objective: tapping a catalog card opens the franchise detail (Figma M09): its core entries, extras and related franchises, the state of each entry and the partial progress, and marking from there; a ✓ button on the card keeps one-tap marking from the catalog.
Branch: `feat/detalle-franquicia` · Delivery: `single-pr` · Test runner: vitest in `apps/web` (Testing Library on jsdom).

## Specs

- S1 (issue #32): "Pantalla de detalle con entradas del núcleo, extras y franquicias relacionadas". RF-16 (docs/requisitos/03-funcionales.md) and Figma M09 "Detalle de franquicia" (35:1331), D09 (36:1689).
- S2 (issue #32): "Estado de cada entrada (vista o no) y progreso parcial". RF-26: "Estado de cada saga con prioridad **Viendo > Vista > Parcial > Sin marcar**. Parcial muestra el progreso del núcleo ("3/5 temporadas")." Figma M35 "Detalle: nueva temporada" (49:4093), D37 (49:4218): "Nueva temporada" — "Salió una entrada nueva. Tu total no cambia: esta saga sigue sumando."
- S3 (issue #32): "Acciones de marcar desde el detalle". Figma M09: per-entry "Viendo" / "Vista" toggle and "Marcar saga como vista".
- S4 (acceptance, @CA-RF16-01): "Dado que vi 3 de las 5 temporadas de una franquicia / Cuando abro su detalle / Entonces veo "3/5 temporadas" y cuáles entradas me faltan". Figma words the progress "3 de 5 vistas"; the screen shows the progress so that "3/5" and the missing entries are visible (L3).
- S5 (stakeholder decision L2): "Toque abre detalle (Recomendado)": tapping a catalog card opens the detail; a ✓ button on the cover marks the franchise in one tap (RNF-01: "Marcar una franquicia requiere un solo clic o toque desde el catálogo.").

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1–S5 | delegated (writer) | done | `franchise/` (FranchiseScreen container, FranchiseDetail view, per-entry optimistic PUT/DELETE), route `/franquicia/:anilistId` under the signed-in layout, card as link plus ✓ button, `putMark`/`deleteMark`, `fetchFranchise` detail; RED then GREEN: 3 client, 2 crawl, 13 screen tests incl. `@CA-RF16-01`; `docs/criterios/RF-16.feature`. Seam check: domain 31, api 135, web 87, landing 26; typecheck, lint, build green. Risk: item 3 |

Route evidence: one unit (detail screen, its route and the card change); delegated for the long-session context backstop of the parent (L4).

## Log

- L1 (2026-11-03, stakeholder): "si" (start #32 after #33 merged).
- L2 (2026-11-03, stakeholder): "Toque abre detalle (Recomendado)" — tap opens the detail; a ✓ button on the cover marks in one tap.
- L3 (2026-11-03, assumptions): route `/franquicia/:anilistId` (any entry id of the franchise; the screen builds the whole franchise with `fetchFranchise` from `apps/web/src/anilist/franchise.ts`, so a deep link works); progress text "3 de 5 vistas" (Figma) with the bar, and the missing core entries shown as not seen; the per-entry control is a two-option toggle (Viendo, Vista): tapping the active option removes that entry's mark (`DELETE`), tapping the other sets it (`PUT`), optimistic with rollback of that entry only, sharing the `['me','marks']` cache with the catalog; "Marcar saga como vista" marks the whole core in one batch, and when the whole core is seen it becomes "Quitar saga de vistas" (core and extras, as the catalog's second tap does). Extras ("Extras · no cuentan para completar") have the same toggle; related franchises are links to their own detail. "Viendo de nuevo" (DD-15) stays out: marking a seen entry as Viendo replaces its seen mark, recorded as a known gap until the rewatch model exists. The ⋯ menu (M10) and "Algo no cuadra" stay out (curator reports, #42).
- L4 (2026-11-03): the parent session is past its context backstop, so T1 goes to one bounded writer with this document as its specification.
- L5 (2026-11-03): writer notes. "Quitar saga de vistas" shows only when the released core is all seen and nothing is Viendo, so the M35 case keeps "Marcar saga como vista"; the subtitle shows the core count, the year range and two genres. A deep link from an extra's or a related entry's own id builds that entry's own group (only SEQUEL/PREQUEL are crawled); every link the app makes uses root ids. Two quick changes to the same entry can resolve out of order. Shared code touched: the marks client returns no body on 204 (DELETE), and the catalog card markup changed (link plus ✓ button); their tests pass. The build's 500 kB chunk warning already shows on main.
- L6 (2026-11-03): independent verifier (Risk item 3) at `500d1f1`: no blockers; S1–S5 pass. Differential check: the baseline web tests pass against the new code once wrapped in a router and with the ✓ button's new names (S5); no other behavior changed. Shared code: only `fetchMarks` and `saveMarks` used the marks client before and neither gets a 204; the session gate still covers both routes. Recorded, not fixed: the saga button and the ✓ button crawl the franchise again on every tap (bounded at 20 requests, outside the query cache); a tap before the first marks fetch ends can leave only that mark in the cache until the next refetch (as in the catalog); no committed test for the detail's offline state or for the absent banner (the verifier's probes covered both).
