# Feature: openings tab in the franchise detail (phase 1)

Objective: the franchise detail gets an "Openings" tab that lists the openings of every entry in release order, each with its title, artist and a link that searches for it on YouTube. No YouTube API and no embedded player in this phase.
Branch: `feat/pestana-openings` · Delivery: `ask-on-risk` · Test runner: vitest in `apps/api` and `apps/web`.

## Specs

- S1 (L1): "cuando esté en la sección de detalle de franquicia quiero que exista una pestaña de openings". The detail shows two tabs; the timeline stays the default one.
- S2 (L1): "que en ella se despliegue en orden los videos de los openings según su lanzamiento". Phase 1 lists the openings, not videos (L2): entries in the order of the timeline (by year), and inside an entry the order MyAnimeList gives (`#1`, `#2`, …).
- S3 (L2): "pestaña Openings con título, artista y link "Ver en YouTube"". The link opens a YouTube search (`https://www.youtube.com/results?search_query=…`) in a new tab; the app calls no YouTube API.
- S4 (L1, L3): "la info de los openings se puede obtener de lo que responde myanimelist". Source: the undocumented `opening_themes` field of `GET /anime/{id}`, verified on 2026-11-21. Each item is `{id, anime_id, text}`; `text` is free text in two shapes: `#1: "again" by YUI (eps 1-14)` and `"Yume Tourou (夢灯籠)" by RADWIMPS`. The number may be zero-padded (`#01`) and the episodes may be a list (`eps 1-47, 1000`). A text that fits neither shape is kept whole as the title.
- S5 (assumption): openings are stored with the detail of each anime (new nullable column; null means "not read since the column exists"). Anime already detailed get them when the weekly job reads them again, or on demand when someone opens the tab (ADR-0043, point 3: at most 8 details per request, the rest comes back as `pending`).
- S6 (assumption): openings travel in their own route, `GET /api/v1/catalog/openings?ids=`, so the catalog pages do not grow; the browser asks for them only when the tab opens.
- S7 (assumption): an entry whose openings are not known yet, and a franchise with none, say so in words instead of showing an empty list.

## Tasks

- [x] T1 · S4, S5, S6 · inline · API: adapter parses `opening_themes`, column `openings`, repository, service with fill on demand, route, OpenAPI, runbook. Commit `d807082`; RED seen on 13 tests, then 653 of 653 green in `apps/api`.
- [x] T2 · S1, S2, S3, S7 · inline · Web: client, hook, tabs in the franchise detail, i18n, styles. Second commit of the branch; 520 of 520 green in `apps/web`, lint, typecheck and `openapi:check` clean.

Route: both inline; no writer trigger holds (T2 depends on the contract of T1).
Forecast: about 600 authored changed lines; two work-unit commits.

## Log

- L1 (2026-11-21, user): "quiero que realices una investigación para un nuevo feature. Quiero que en la exploración de anime, cuando esté en la sección de detalle de franquicia quiero que exista una pestaña de openings y que en ella se despliegue en orden los videos de los openings según su lanzamiento. Creo que la info de los openings se puede obtener de lo que responde myanimelist. Lo otro que quiero que investigues es si puedo agregar los videos de youtube en la web o almenos la url del opening respectivo. Si es que se puede hacer una implementación legal colaborando con youtube para eso."
- L2 (2026-11-21, user, answering "¿Querés que arme la implementación de la fase 1 (pestaña Openings con título, artista y link "Ver en YouTube")?"): "si, armá la fase 1". Phase 2 (embedded player with cached video ids) stays out: the rules of YouTube on storing video ids were not verified, and `search.list` allows 100 calls a day.
- L3 (2026-11-21, evidence): live request with the project's client id for anime 5114, 48556, 21 and 32281, all HTTP 200. `opening_themes` came in release order; `videos` also exists (`youtu.be` url and thumbnail) but the sampled items were trailers.
- L4 (2026-11-21, pending): the tab was not looked at in a browser, and `docs/requisitos` has no requirement for it yet (RF-16 covers the detail, not the openings).
