# Feature: the explorer as worlds ("Mundos")

Objective: Explorar stops being one catalog with a switch and becomes a map of worlds (Anime, Dramas, and a locked Series), each with its own native way of filtering. Design: alternative D of the Claude Design canvas https://claude.ai/artifact/PZQ2nikrwMQhMeUHP3yDTt (boards M1 to M4).
Branch: `feat/explorador-mundos` · Delivery: `ask-on-risk` · Test runner: vitest in `apps/web`, Playwright in `apps/e2e`.

## Specs

- S1 (L2): "La de los Mundos. Sigamos con ese planteamiento." Explorar has a map of worlds (board M1): Anime, Dramas, and Series shown as locked. Anime and dramas stay separate catalogs; neither asks for the other's data.
- S2 (L4): "la segunda, que reabra el último mundo". Explorar reopens the last world visited, with the map one tap away. The map is the entry only when no world was visited yet on this device.
- S3 (assumption): each world has its own address (`/anime`, `/dramas`) and the map has `/mundos`; `/` only decides where Explorar opens. Links that mean "the anime catalog" point to `/anime`.
- S4 (assumption): the last world is kept on the device (localStorage), not in the account. Without storage, Explorar opens on the map.
- S5 (assumption): inside a world, a header names the world and has the way back to the map (board M2). It replaces the Anime / Dramas switch.
- S6 (assumption, board M1): the map lets you enter the Anime world straight into one era and the Dramas world straight into one country.
- S7 (L3, delivery 2): Anime world with "Niveles por" Era / Género / Formato in view instead of the filter sheet (board M2).
- S8 (L3, delivery 3): Dramas world with country tiles and genres in view (board M3). Its year axis waits for the API: `/api/v1/dramas` filters by origin and genres only.
- S9 (L3, delivery 4): crossing the worlds by genre and searching across worlds (board M4, and the search and genre chips of M1). Needs an equivalence between the MyAnimeList genres and the TVmaze ones.

The app copy keeps the word "Dramas" that every other screen uses; the boards say "Doramas" (open copy question, see L6).

## Tasks

- [x] T1 · S1, S2, S3, S4, S5 · inline · Shell: routes, last world, map with one door per world, world header, navigation, links, i18n, styles, e2e, runbook. First commit of the branch; RED seen on 11 tests, then 529 of 529 green in `apps/web`, typecheck and lint clean.
- [ ] T2 · S6 · inline · Doors by level: era stops and country tiles on the map, `?era=` and `?origin=` on the worlds.
- [ ] T3 · S7 · pending, not started (delivery 2).
- [ ] T4 · S8 · pending, not started (delivery 3).
- [ ] T5 · S9 · pending, not started (delivery 4).

Route: T1 and T2 inline; no writer trigger holds (T2 builds on the map of T1).
Forecast: about 450 authored changed lines for T1 and 200 for T2; one work-unit commit each.

## Log

- L1 (2026-11-25, user): "En esta sesion quiero que trabajemos en mejorar la UX/UI del explorador. Quiero que sea una experiencia entretenida de realizar. Por lo que los filtros y como se usan debe ser lo primodiarl. La forma ..." (as kept in memory; the rest of the message was not preserved).
- L2 (2026-11-25, user, choosing among the five alternatives of the canvas): "La de los Mundos. Sigamos con ese planteamiento."
- L3 (2026-11-25, user): "continuemos con la mejora visual al catalogo Exploraci´ón". The four deliveries proposed in answer: 1 shell of worlds, 2 Anime world, 3 Dramas world, 4 genre crossing and search across worlds.
- L4 (2026-11-25, user, answering "¿Explorar abre siempre en el mapa de mundos, o reabre el último mundo que visitaste con el mapa a un toque?"): "la segunda, que reabra el último mundo".
- L5 (2026-11-25, user, answering "¿Arranco ya con la implementación de la entrega 1 en una rama, o preferís antes revisar y ajustar las pantallas del prototipo?"): "arranquemos".
- L6 (2026-11-25, evidence): `apps/web/src/styles.css` already carries the tokens of the Acrux design system the boards use, so the boards translate to the existing classes and variables. The boards were never looked at in a browser by the agent. The direct Anime / Dramas switch disappears with S5: going from one world to the other takes two taps through the map.
- L7 (2026-11-25, evidence, T1): map and world headers looked at in a browser at 390 and 1280 px through a throwaway preview page (not committed); they match board M1 and the top of M2. The Playwright journeys were rewritten but not run: they need a disposable Postgres (`DATABASE_URL`) this session does not have, so CI is their first run. `docs/requisitos` has no requirement for the drama section or the worlds yet.
