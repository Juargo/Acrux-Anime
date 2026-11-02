# Feature: API rate limits with Upstash (issue #27)

Objective: requests over a limit get 429 with `Retry-After`, per user on private routes and per IP on public ones, stored in Upstash Redis at no cost.
Branch: `feat/limite-de-peticiones` · Delivery: `ask-on-risk` · Test runner: vitest in `apps/api` and `apps/landing`; Upstash adapter against a local REST emulator in testcontainers.

## Specs

- S1 (issue #27): "Comparar ambas opciones en costo cero y precisión". Done in conversation (L2); recorded in ADR-0028.
- S2 (issue #27): "Implementar límites por usuario y por IP; primero en escrituras, perfil público y lista de espera".
- S3 (issue #27): "Responder 429 con `Retry-After`".
- S4 (issue #27): "Registrar la elección en ADR-0028".
- S5 (acceptance): "Superar el límite devuelve 429 con `Retry-After`".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S2, S3, S5 | inline | done | `rateLimit` route option, 429 with `Retry-After`, Upstash adapter tested against Redis behind the REST emulator; RED then GREEN, 72 API tests. Risk: items 2, 5 |
| T2 | S2, S3, S5 | inline | done | landing counter and 429 with `Retry-After`, form message in es and en; RED then GREEN, 24 landing tests, build. Risk: items 2, 5 |
| T3 | S1, S4 | inline | done | ADR-0028 notes, P-10 resolved, privacy policy names Upstash (es, en), runbook `docs/runbooks/limite-de-peticiones.md` |
| T4 | S2 | stakeholder (secrets) | pending | Upstash account, region, DPA, Vercel variables, firewall rule |
| T5 | S5 | after setup | pending | limit exceeded on a preview |

## Log

- L1 (2026-11-02, stakeholder): "continuemos" (#27), then "vamos con Upstash".
- L2 (2026-11-02): comparison. Vercel firewall: free, but Hobby allows one rate limit rule per project, so every route would share one limit, and the SDK does not report when the window resets. Upstash: 500,000 commands a month free, any number of limits, exact reset for `Retry-After`; it adds a data processor. Neon: no new account, but about 130 ms more per check and more compute.
- L3 (assumptions): the API has no write or public profile routes yet, so T1 delivers the mechanism and a route option, applied when those routes land (#28 onwards). Default limits: writes 30 a minute per user; public routes 60 a minute per IP; waitlist 5 per 10 minutes per IP, as the current firewall rule. Keys are hashed and expire with their window. If Upstash fails or is not configured, requests pass and the API logs a warning, so a store outage never takes the API down.
- L4 (2026-11-02): `@upstash/ratelimit` was dropped: its Lua scripts carry an Upstash-only flag (`allow-key-locking`) that Redis 7 and 8 reject, so it cannot be tested against a local store. The adapter keeps a fixed window with `INCR` and `EXPIREAT` in one transaction on `@upstash/redis`, one HTTP round trip per check. The client IP comes from `x-vercel-forwarded-for`, which Vercel overwrites. A check slower than one second throws `TimeoutError`, and the API lets the request through.
- L5 (2026-11-02): the landing keeps its own copy of the fixed window. The API compiles with `tsc` and Node runs the compiled files, so a shared workspace package would need its own build before typecheck and tests in CI; the two apps never share counters. The waitlist counts every attempt, valid or not, before reading the email, and shows a new message in es and en. The firewall rule on the landing answers 429 without `Retry-After`, so the stakeholder must remove or loosen it (T4).
