# Feature: my list of seen and watching (issue #35)

Objective: a "Mi lista" screen (Figma M12/D12, M13/D13) shows the franchises the user is watching and the ones they saw, with covers and titles from AniList, reached from a navigation bar; the marks API pages with a cursor.
Branch: `feat/mi-lista` · Delivery: `single-pr` · Test runner: vitest (`apps/api` with supertest and Testcontainers, `apps/web` with Testing Library on jsdom).

## Specs

- S1 (issue #35): "Pantallas de vistos y de viendo ahora". RF-27: "El usuario ve su lista de vistos y de viendo ahora, con estado vacío." Figma M12 "Mi lista" (37:2163): "animes completos", "entradas vistas", "viendo ahora", tabs "Viendo (3)" / "Vistas (48)", rows "8 de 8 · marcada el 12 de oct."; M13 (37:2279): "Aún no estás viendo nada" / "Marca una saga como "Viendo" y aparecerá en tu tarjeta." / "Explorar el catálogo". RNF-42: "El contador siempre coincide con la lista visible, y los cambios del catálogo nunca le restan (DD-03)."
- S2 (issue #35): "Paginación por cursor en `GET /api/v1/me/marks`".
- S3 (issue #35): "Portadas y títulos con una consulta por lotes a AniList".
- S4 (acceptance, @CA-RF27-01): "Dado que marqué 2 franquicias como "viendo ahora" / Cuando abro "Viendo ahora" / Entonces veo esas 2 franquicias con su portada".
- S5 (stakeholder decision L2): "Barra con 2 pestañas (Recomendado)": the Figma navigation bar with only Explorar and Mi lista; Tarjeta and Perfil join with their issues.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S2 | inline | done | T1 commit: `?cursor=&limit=` (default 500, max 1000, 400 `marks.invalid_query`, repeated params rejected), `nextCursor` as a string, query parameters in the OpenAPI generator, `fetchMarks` reads every page (1000 each) and stops on a cursor that does not move. RED 9 route tests + 1 client test, then GREEN; api 152, web 98. Risk: item 3 (the GET contract now pages; its only consumer, the SPA, reads every page in the same commit) |
| T2 | S3 | inline | done | `useMarkedFranchises` keeps the crawl in the query cache (one crawl for the counter and the list, from every marked id) and `useCounterMode` shares the mode; `useTotalCounter` reads from them. Counter tests unchanged and green; web 98. Risk: none (internal refactor, covered by the counter tests) |
| T3 | S1, S4, S5 | inline | done | `my-list/` (`myList` rows and figures, MyListScreen with tabs, stats and the M13 empty states), route `/mi-lista`, `MainNav` (Explorar, Mi lista; bottom bar, sidebar from 1024px), counter mode in the outlet context, `docs/criterios/RF-27.feature`. `myList` RED then GREEN (5 tests); the 5 screen tests (incl. `@CA-RF27-01`) were written after the screen, so no RED was observed for them. Web 108, typecheck, lint, build green. Risk: none |

Route evidence: one feature in dependent deliveries (API paging, shared marked-franchises store and navigation, then the screen); no writer trigger holds.

## Log

- L1 (2026-11-03, stakeholder): "si" (start #35 after #34 merged).
- L2 (2026-11-03, stakeholder): "Barra con 2 pestañas (Recomendado)".
- L3 (2026-11-03, assumptions): `GET /api/v1/me/marks?cursor=<anilistId>&limit=<n>` keeps the anilistId order; `limit` defaults to 500 and goes up to 1000; `nextCursor` is the last anilistId of the page as a string while more marks follow, else null; an invalid cursor or limit answers 400 `marks.invalid_query`. The SPA reads every page. The list reuses the crawl of the counter (`id_in` batches, S3), shared through the query cache so the counter and the list crawl once, now from every marked id (seen and watching). "Vistas" lists what the counter counts (RNF-42): complete franchises when counting by franchises, every seen entry when counting by entries; "Viendo" lists the franchises in state Viendo (RF-26). Rows show cover, title, "N de M" (seen core over released core) and "marcada el <day> de <month>." from the latest mark, newest first, and link to the detail. The "Contar por" switch stays in the header counter (one control, shared mode). Vistas is the default tab. Empty Vistas: "Aún no marcaste nada como visto." with "Explorar el catálogo". The bar sits at the bottom on phones and as the Figma D12 sidebar on wide screens.
- L4 (2026-11-03): T3 notes. A franchise that is complete and has a new season in Viendo shows in both tabs, as the counter counts it. Partial franchises (some core seen, nothing Viendo) show in neither tab while counting by franchises, as the counter leaves them out. An entry AniList does not return still shows in Vistas by entries as "Entrada <id>". The query cache (marks, crawl, mode) is not cleared on sign-out, as before this change.
- L5 (2026-11-03): independent verifier (Risk item 3) at `df5b141`: no blockers; S1–S5 pass; Vistas equals the counter in both modes in every probe; paging probes on Postgres (1001 marks, exact pages, int4 edges, 400 cases) pass. Differential: baseline catalog, detail and profile tests pass unchanged; the only failures are the fakes of the requested contract change. Fixed after it, RED then GREEN: by franchise the counter shows 0 at once when nothing is seen (before, a watching-only user saw "—" while AniList was down), and `fetchMarks` fails on a cursor that does not move forward. Recorded, not fixed: an entry AniList does not return links to a detail that cannot resolve; the tabs have no arrow-key navigation; no nav item is current on a franchise detail; the counter mode lives in the query cache, not cleared on sign-out (sign-in reloads the page). Native review: stakeholder chose "Omitir esta vez".
