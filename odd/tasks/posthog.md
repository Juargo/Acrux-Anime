# Feature: PostHog in the web app, event plan and beta KPIs (issue #46)

Objective: the web app asks for analytics consent as the landing does, sends the ADR-0030 events without personal data to PostHog EU only after consent, identifies people with a salted hash from the API, measures Core Web Vitals on phones, and the repository documents the KPI dashboard and the external monitor of `/api/health`.
Branch: `feat/posthog` · Delivery: `single-pr` · Test runner: vitest (`apps/api` with supertest, `apps/web` with Testing Library on jsdom).

## Specs

- S1 (issue #46): "Banner de consentimiento en la web app (mismo criterio que la landing)". ADR-0028: "**Analítica solo con consentimiento:** PostHog funciona sin cookies ni identificadores persistentes hasta que el usuario acepta; sin captura automática de campos de texto (ADR-0030)." ADR-0028: the user can withdraw consent at any time. Landing copy: "¿Nos ayudas a medir?", "Usamos analítica para saber si Acrux le sirve a más gente. Sin cookies hasta que aceptes, y puedes cambiarlo cuando quieras desde el pie de página.", "Más información", "Rechazar", "Aceptar".
- S2 (issue #46): "Eventos de ADR-0030 sin datos personales en las propiedades". ADR-0030: "`waitlist_joined`, `signup_completed`, `anilist_linked`, `franchise_marked`, `counter_mode_changed`, `card_generated`, `card_shared`, `list_made_public`, `public_profile_viewed`, `plus_checkout_started`, `plus_purchased`, `account_deleted`. Las propiedades nunca incluyen datos personales: ni correo, ni nombre, ni el texto de búsqueda." Plus `anilist_rate_limited` (ADR-0024, ADR-0030).
- S3 (issue #46): "Core Web Vitals en móvil". RNF-10: "Core Web Vitals en móvil: LCP < 2,5 s; INP < 200 ms; CLS < 0,1".
- S4 (issue #46): "Tablero: tarjetas compartidas por semana, activación, tasa de compartir, retención D7 y D30". RN-M1: "Tiempo hasta la primera tarjeta compartida | < 3 minutos (mediana) | `signup_completed` → `card_shared`"; RN-M2: "Tasa de compartir por usuario activo | Por definir tras la beta | `card_shared` / activos"; RN-M3: "Retención D7 y D30 | Por definir tras la beta | Retención en PostHog".
- S5 (issue #46): "Monitor externo gratuito de `/api/health`". RNF-22: "`/api/health` ≥ 99,5 % mensual".
- S6 (acceptance, issue #46): "El tablero muestra los KPIs de ADR-0030 con datos de la vista previa".
- S7 (stakeholder decision L2): "Salted hash from the API (Recommended)": `/me` returns an `analyticsId`, an HMAC of the user id with a server secret; the app identifies with it after consent.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S7, S2 | inline | done | `e6e9ed2`: `ANALYTICS_ID_SECRET` (≥ 32 characters, optional); `/me` and `PATCH /me` return `analyticsId` (HMAC-SHA256 hex, 32 characters; null without the secret) and `createdAt`. RED 4, GREEN; API 233, depcruise, `openapi:check`. Risk: items 2 (a new secret) and 3 (`/me` grows) |
| T2 | S1, S2, S3, S7 | inline | done | `e256a81`: `analytics/` (consent with the landing's key, posthog-js loaded only after "Aceptar" with the landing's options plus `history_change` pageviews and bundled web vitals, identify with `analyticsId`, `signup_completed` once per device at `createdAt`, revoke = opt out + reset + `ph_*` removed), banner, Perfil "Analítica" row, every callback wired (App, `main.tsx`, catalog and detail, public profile, AniList 429). RED 11 + 6, GREEN; web 231, build. Risk: items 2 (consent, what reaches PostHog) and 5 (`posthog-js`) |
| T3 | S4, S5, S6 | inline | done | `docs/runbooks/analitica.md` (events, setup, the dashboard's insights, UptimeRobot monitor, the #46 check) and the identity decision in ADR-0030. The stakeholder creates the dashboard, the monitor and the Vercel variables. Risk: none |

Route evidence: one feature in dependent deliveries (API id, then the app, then the runbook); no writer trigger holds.

## Log

- L1 (2026-11-05, stakeholder): "vamos con PostHog".
- L2 (2026-11-05, stakeholder): identity: "Salted hash from the API (Recommended)".
- L3 (2026-11-05, assumptions): The app copies the landing's PostHog options (EU host, `person_profiles: 'identified_only'`, no autocapture, heatmaps, dead clicks, exceptions, recordings, surveys, experiments, remote code or flags) and adds `capture_performance` web vitals (S3). Consent lives in `localStorage` under the landing's key `acrux:analytics-consent` (each origin keeps its own). The banner text says "desde tu perfil" instead of "desde el pie de página", and "Más información" opens the landing's privacy policy; Perfil gets an "Analítica" row to change it. Revoking calls `opt_out_capturing`, `reset` and removes the `ph_*` keys. `signup_completed` is sent once per device after consent, timestamped at the profile's `createdAt`, so the RN-M1 funnel holds when consent comes later. `analyticsId` is the first 32 hex characters of HMAC-SHA256(user id, `ANALYTICS_ID_SECRET`); without the secret it is null and the app captures anonymously. Events without a feature yet (`anilist_linked`, `plus_checkout_started`, `plus_purchased`, `account_deleted` and the PostHog person deletion) arrive with their issues; `waitlist_joined` stays in the landing.
- L4 (2026-11-05): T1–T3 done. posthog-js loads web vitals from its CDN unless `posthog-js/dist/web-vitals` is imported, which `main.tsx` does, so remote code stays off and the CSP needs no new host.
