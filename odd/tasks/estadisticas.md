RF-53: advanced stats unlocked by Plus (epic #50). Branch feat/estadisticas, single PR.
Test runner: Vitest (web, jsdom) and Playwright E2E.

## Specs

- S1 (RF-53, verbatim): "Plus desbloquea estadísticas avanzadas."
- S2 (user decision, 2026-11-09). The first version shows: "Horas y episodios vistos", "Géneros favoritos", "Por año y formato".
- S3 (user decision, 2026-11-09): "Adelanto + bloqueo". A free user sees their own hours and episodes for free. Genres and year/format appear blurred with "Ver Acrux Plus", following the RF-52 pattern of trying it with your own data before paying.
- S4 (assumption):
  - Only marks with status `seen` count, the same as the counter.
  - Episodes are the sum of AniList `episodes`; hours are the sum of `episodes × duration` (minutes) / 60.
  - A title whose episodes or duration AniList does not know (e.g. still airing) counts as one title but adds no episodes or hours, and the screen says how many were left out.
- S5 (assumption):
  - Genres are the top 5 by number of seen titles, as a percentage of seen titles.
  - Year is grouped by release decade, using `seasonYear`.
  - Format uses the existing `formatLabel`.
- S6 (assumption, ADR-0024):
  - Stats are computed in the browser from the user's marks plus one AniList query (`MediaStats`, batches of 50 ids, `isAdult: false`).
  - The Plus lock is visual. The blurred data is the user's own marks crossed with public AniList data, and nothing new is exposed.
  - The plan comes from `profile.plan`, which `GET /me` reads on the server.
- S7 (assumption):
  - Entry point: a "Estadísticas" row in Perfil, at route `/perfil/estadisticas`, shown to everyone.
  - "Ver Acrux Plus" links to `/perfil/plus` when `plusAvailable`; otherwise the screen shows the existing "soon" text.

## Tasks

- [x] T1 [S2, S4, S5] Pure stats computation (`stats/compute.ts`) plus the `MediaStats` AniList query and hook, with unit tests. Route: inline. Commit 81911bc. RED observed, then GREEN (42/42).
- [x] T2 [S1, S3, S6, S7] Screen, route, Perfil row, i18n, CSS, and screen tests. Route: inline. Commit 9969750. Web suite 351/351.
- [x] T3 [S1, S3] RF-53.feature, E2E stub branch and journey, runbook and RF-53 text. Route: inline. Commit c0f424c. E2E 16/16 (chromium and webkit).

## Log

- L1 (2026-11-09, user): "continuemos con las estadísticas avanzadas RF-53"
- L2 (2026-11-09, user): the stats are "Horas y episodios vistos, Géneros favoritos, Por año y formato"; the free user gets "Adelanto + bloqueo (Recomendado)".
- L3: Explorer map.
  - MEDIA_BY_IDS lacks episodes, duration and genres, so a separate MediaStats query keeps the card and lists untouched.
  - The E2E AniList stub throws on unknown query names.
  - There is no reusable Plus CTA or blur style.
  - Routes are static in routes/signed-in-routes.tsx.
- L4: The locked part does not render the user's genres, decades or formats; it shows three blurred placeholder bars under the offer. No real data reaches the DOM for a free user, which is stricter than S6's visual lock.
- L5: plus.spec.ts on main still seeded order ids from seconds, so parallel workers collided (the fix lived in closed PR #103). It now seeds from Date.now()*1000 plus randomInt.
- L6: Risk: none. No high-risk item applies: no migration, no API or guard change, and the plan check is display-only over the user's own data. There is no independent verifier.
