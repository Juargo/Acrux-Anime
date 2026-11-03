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
- L2 (assumptions): no screen uses the catalog yet (#31 onwards), so the client ships with its hook and its error messages, and the screens show them when they land. Marks live in the API, never in the AniList cache, so a failed catalog query cannot lose them. PostHog is not in the SPA yet (#46): the client calls an `onRateLimited` hook, and #46 sends `anilist_rate_limited` from it. There is no service worker yet (#44); the rule stays in ADR-0024 for it. When `X-RateLimit-Remaining` reaches 0, the next request waits for the next minute window instead of spending a 429.
- L3 (2026-11-03): `zod` and `@tanstack/react-query` added to `apps/web`. TanStack Query retries only network failures, once; the client already waits out 429s. The query client is created once in `main.tsx`; no screen calls `useMediaByIds` yet.
