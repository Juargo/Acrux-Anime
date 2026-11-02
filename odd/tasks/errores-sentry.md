# Feature: error tracking with Sentry (issue #26)

Objective: errors from the SPA and the API reach Sentry without personal data, API errors carry their `requestId`, and new issues alert by email.
Branch: `feat/errores-sentry` · Delivery: `ask-on-risk` · Test runner: vitest in `apps/api`; `apps/web` has no runner, so it gets a build check and the preview proof.

## Specs

- S1 (issue #26): "SDK de Sentry en `apps/web` y `apps/api` con `sendDefaultPii: false` y depuración de datos sensibles".
- S2 (issue #26): "Subida de *source maps* desde CI".
- S3 (issue #26): "Adjuntar el `requestId` a los eventos".
- S4 (issue #26): "Alertas por correo ante problemas nuevos".
- S5 (issue #26): "Agregar el origen de Sentry a `connect-src` de la CSP en `apps/web/vercel.json` (viene de #21)".
- S6 (acceptance): "Un error provocado en la vista previa aparece en Sentry con su `requestId` y sin datos personales".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S3 | inline | pending | API reporter, scrubbing, tests. Risk: item 5 |
| T2 | S1, S2, S5 | inline | pending | SPA SDK, CSP, source maps in the deploy build, runbook. Risk: items 2, 5 |
| T3 | S4 | stakeholder (secrets) | pending | Sentry account in the EU region, alert rule, DSN, CI token |
| T4 | S6 | after setup | pending | error provoked on a preview |

## Log

- L1 (2026-11-01, stakeholder): "continuemos con #26. Busca una alternativa free", then "continuemos con sentry" after comparing Sentry, PostHog and GlitchTip. The Developer plan is free: 5,000 errors, one user, email alerts. Whether signing up asks for a card is unconfirmed.
- L2 (assumptions): one Sentry project for both apps, because the quota is shared and it keeps setup to one DSN. EU data region, matching PostHog in ADR-0028; the region cannot be changed later. The API is compiled by `tsc` without minifying, so its stack traces are readable without uploading maps; only the SPA uploads them. The SPA has no API client yet, so S3 applies to API events until one exists. The S6 error is provoked from a throwaway branch, so no failing route is merged.
