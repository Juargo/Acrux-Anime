# Feature: the explorer as worlds ("Mundos")

Objective: Explorar stops being one catalog with a switch and becomes a map of worlds (Anime, Dramas, and a locked Series), each with its own native way of filtering. Design: alternative D of the Claude Design canvas https://claude.ai/artifact/PZQ2nikrwMQhMeUHP3yDTt (boards M1 to M4).
Branch: `feat/explorador-mundos` · Delivery: `ask-on-risk`, chain `stacked-to-main` · Test runner: vitest in `apps/web`, Playwright in `apps/e2e`.

## Specs

- S1 (L2): "La de los Mundos. Sigamos con ese planteamiento." Explorar has a map of worlds (board M1): Anime, Dramas, and Series shown as locked. Anime and dramas stay separate catalogs; neither asks for the other's data.
- S2 (L4): "la segunda, que reabra el último mundo". Explorar reopens the last world visited, with the map one tap away. The map is the entry only when no world was visited yet on this device.
- S3 (assumption): each world has its own address (`/anime`, `/dramas`) and the map has `/mundos`; `/` only decides where Explorar opens. Links that mean "the anime catalog" point to `/anime`.
- S4 (assumption): the last world is kept on the device (localStorage), not in the account. Without storage, Explorar opens on the map.
- S5 (assumption): inside a world, a header names the world and has the way back to the map (board M2). It replaces the Anime / Dramas switch.
- S6 (assumption, board M1): the map lets you enter the Anime world straight into one era and the Dramas world straight into one country.
- S7 (L3, delivery 2): Anime world with "Niveles por" Era / Género / Formato in view instead of the filter sheet (board M2). Assumptions, none of them asked: (a) the axis picks which levels are in view, and the other two stay below as chips that say what they hold ("Género · 1", the name of the era) and bring their levels into view; (b) one era at a time: a stop takes the whole era, the years narrow it, "Todos" widens it, the same stop leaves every era; (c) every pick applies at once, with nothing to confirm; (d) the search waits behind the button of the header, and closing it clears it; (e) the copy says "Formato" where it said "Tipo" and "Era" where it said "Época".
- S8 (L3, delivery 3): Dramas world with country tiles and genres in view (board M3). Its year axis waits for the API: `/api/v1/dramas` filters by origin and genres only.
- S9 (L3, delivery 4): crossing the worlds by genre and searching across worlds (board M4, and the search and genre chips of M1). Needs an equivalence between the MyAnimeList genres and the TVmaze ones.

The app copy keeps the word "Dramas" that every other screen uses; the boards say "Doramas" (open copy question, see L6).

## Tasks

- [x] T1 · S1, S2, S3, S4, S5 · inline · Shell: routes, last world, map with one door per world, world header, navigation, links, i18n, styles, e2e, runbook. Commit `6ecb3dc`; RED seen on 11 tests, then 529 of 529 green in `apps/web`, typecheck and lint clean.
- [x] T2 · S6 · inline · Doors by level: era stops and country tiles on the map, `?era=` and `?origin=` on the worlds; `ERAS` moved to `apps/web/src/catalog/eras.ts`. Second commit of the branch; RED seen on 4 tests, then 535 of 535 green in `apps/web`, typecheck clean in every package, lint clean.
- [x] T3 · S7 · inline · Anime world by levels: axis control, era rail and years row, genre and format chips in view; `FilterSheet` and `EraFilter` removed. Branch `feat/mundo-anime`, one commit; RED seen on 9 tests of `CatalogScreen` plus the new `EraLevels` file, then 532 of 532 green in `apps/web`, typecheck clean in every package, lint with no new finding.
- [ ] T4 · S8 · pending, not started (delivery 3).
- [ ] T5 · S9 · pending, not started (delivery 4).

Route: T1 and T2 inline; no writer trigger holds (T2 builds on the map of T1).
Forecast: about 450 authored changed lines for T1 and 200 for T2; one work-unit commit each. T3 inline as well (one behavior, no writer trigger).

## Log

- L1 (2026-11-25, user): "En esta sesion quiero que trabajemos en mejorar la UX/UI del explorador. Quiero que sea una experiencia entretenida de realizar. Por lo que los filtros y como se usan debe ser lo primodiarl. La forma ..." (as kept in memory; the rest of the message was not preserved).
- L2 (2026-11-25, user, choosing among the five alternatives of the canvas): "La de los Mundos. Sigamos con ese planteamiento."
- L3 (2026-11-25, user): "continuemos con la mejora visual al catalogo Exploraci´ón". The four deliveries proposed in answer: 1 shell of worlds, 2 Anime world, 3 Dramas world, 4 genre crossing and search across worlds.
- L4 (2026-11-25, user, answering "¿Explorar abre siempre en el mapa de mundos, o reabre el último mundo que visitaste con el mapa a un toque?"): "la segunda, que reabra el último mundo".
- L5 (2026-11-25, user, answering "¿Arranco ya con la implementación de la entrega 1 en una rama, o preferís antes revisar y ajustar las pantallas del prototipo?"): "arranquemos".
- L6 (2026-11-25, evidence): `apps/web/src/styles.css` already carries the tokens of the Acrux design system the boards use, so the boards translate to the existing classes and variables. The boards were never looked at in a browser by the agent. The direct Anime / Dramas switch disappears with S5: going from one world to the other takes two taps through the map.
- L7 (2026-11-25, evidence, T1): map and world headers looked at in a browser at 390 and 1280 px through a throwaway preview page (not committed); they match board M1 and the top of M2. The Playwright journeys were rewritten but not run: they need a disposable Postgres (`DATABASE_URL`) this session does not have, so CI is their first run. `docs/requisitos` has no requirement for the drama section or the worlds yet.
- L8 (2026-11-25, evidence, T2): the map with its doors looked at in a browser at 320, 390 and 1280 px; at 320 px the era stops overlapped and "Japón" overflowed its tile, both fixed (the stop narrows, the country name scales with the viewport). Design detector of the Impeccable skill: no findings. An unknown `?era=` or `?origin=` opens the world unfiltered. The running count passed the forecast (about 820 changed lines in T1, mostly tests), so the slicing into pull requests is the user's open decision. Receipt-driven development is off (global), so no native review ran.
- L9 (2026-11-25, user, answering "¿La subo como dos PRs encadenadas (cascarón primero, puertas por nivel después), como hicimos con Openings, o como una sola?"): "dos encadenadas". Slices: PR #180 `feat/mundos-cascaron` to `main` holds `6ecb3dc` (T1, 822 lines, over the budget: the routes, the header and the map do not work apart); PR #181 `feat/explorador-mundos` to `feat/mundos-cascaron` holds `c66c7cb` and `d6a2d5a` (T2, 372 lines). When #180 merges, #181 has to be pointed at `main`.
- L10 (2026-11-26, user): "continuemos con las modificaciones del catalogo explorador". State found: #180 merged; #181 (T2) open against `main`, checks green and mergeable, waiting for the user. T3 started on `feat/mundo-anime`, branched from `feat/explorador-mundos`, so it has to be rebased or have `main` merged in once #181 is squashed.
- L11 (2026-11-26, evidence, T3): what the board changes for people who used the old filter: years of several eras can no longer be picked together, and the decade rows with "Ninguno" and "Limpiar filtro" are gone; the counts per year and the dot on the current year stay. Looked at in a browser at 320, 390 and 1280 px through a throwaway preview page with fake data (not committed): it matches board M2, with no horizontal overflow on the phones. Design detector of the Impeccable skill: no findings. The Playwright journey `marcar-y-compartir` got the tap on "Buscar en Anime" but was not run (no disposable Postgres in this session): CI is its first run. Receipt-driven development was not consulted; no native review ran.
