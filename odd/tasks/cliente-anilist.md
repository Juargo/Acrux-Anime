# Feature: AniList GraphQL client (issue #29)

Objective: the SPA queries AniList directly with typed, Zod-validated, adult-free batch queries, keeps the catalog only in memory and waits out rate limits instead of failing.
Branch: `feat/cliente-anilist` · Delivery: `single-pr` · Test runner: vitest in `apps/web`, with a fake `fetch` and clock.

## Specs

- S1 (issue #29): "Cliente con `fetch` y consultas tipadas; cada respuesta validada con Zod".
- S2 (issue #29): "TanStack Query solo en memoria (sin persistencia); el service worker no cachea respuestas de AniList".
- S3 (issue #29): "Consulta por lotes (`id_in`) para listas y tarjeta".
- S4 (issue #29): "Lectura de `X-RateLimit-Remaining`; ante 429, retroceso exponencial según `Retry-After`". ADR-0024, rule 4, corrected on 2026-10-29: the browser cannot read `Retry-After` because AniList does not expose it through CORS, so the client waits until `X-RateLimit-Reset` and falls back to exponential backoff.
- S5 (issue #29): "`isAdult: false` en todas las consultas".
- S6 (issue #29): "Evento `anilist_rate_limited` (ADR-0030)".
- S7 (acceptance, @CA-ADR24-01): "Dado que AniList responde 429 con Retry-After / Cuando la app consulta el catálogo / Entonces la app espera y reintenta / Y si sigue fallando, veo un mensaje claro sin perder lo que marqué".
- RNF-21: "Sin conexión, o si AniList no responde o limita las peticiones, la app lo informa con un mensaje claro y no pierde lo marcado."

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S3, S4, S5, S6, S7 | inline | done | client with 429 handling and the `onRateLimited` hook, batch query, RNF-21 messages; RED then GREEN, 12 tests. Risk: item 5 |
| T2 | S2 | inline | done | in-memory QueryClient without persister, retry policy, provider, `useMediaByIds`; 23 web tests, build. Risk: item 5 |

## Log

- L1 (2026-11-03, stakeholder): "oka, vamos" (#29).
- L2 (assumptions): no screen uses the catalog yet (#31 onwards), so the client ships with its hook and its error messages, and the screens show them when they land. Marks live in the API, never in the AniList cache, so a failed catalog query cannot lose them. PostHog is not in the SPA yet (#46): the client calls an `onRateLimited` hook, and #46 sends `anilist_rate_limited` from it. There is no service worker yet (#44); the rule stays in ADR-0024 for it. When a successful answer brings `X-RateLimit-Remaining` at 0, the next request waits 60 seconds instead of spending a 429.
- L3 (2026-11-03): `zod` and `@tanstack/react-query` added to `apps/web`. TanStack Query retries `unavailable` errors (network failures and 5xx) and unknown errors, once; the client already waits out 429s. The query client is created once in `main.tsx`; no screen calls `useMediaByIds` yet.
- L4 (2026-11-03): live check of `MEDIA_BY_IDS` against graphql.anilist.co with ids 101922, 21 and 1535: HTTP 200, `x-ratelimit-limit: 30`, `x-ratelimit-remaining: 29`, CORS exposes `X-RateLimit-Remaining` and `X-RateLimit-Reset`; AniList returned them in another order (21, 1535, 101922), which `fetchMediaByIds` puts back in the requested order; every field matched the schema (101922 → idMal 38000).
- L5 (2026-11-03): independent verifier, 1 probable blocker, fixed here: a 429 that also carried `X-RateLimit-Remaining: 0`, as AniList documents, set the 60-second pause and overrode `X-RateLimit-Reset`; the pause now applies to successful answers only. Also fixed from the advisories: an `onRateLimited` callback that throws no longer breaks the request; covers must be https URLs; repeated ids are requested once. Verifier's live check (2 requests): adult ids 113425, 110270 and 8861 and the manga 30013 are dropped by the batch query. Recorded, not fixed: `queryFn` ignores TanStack's abort signal; the bundle grows by 7.5 kB gzip. Verifier ran on Node 26, not 22.
- L6 (2026-11-03): verifier recheck at `6356a99`, no real requests: a 429 with `remaining: 0` and a 30-second reset waits once for 30 s; a 200 with `remaining: 0` still pauses concurrent requests for 60 s together; four 429s still end in `rate-limited`. Blocker resolved.
- L7 (2026-11-03, stakeholder): "Omitir esta vez" for the native review of the commits against main (13 files, 545 lines, medium risk).
