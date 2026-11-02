# Feature: error tracking with Sentry (issue #26)

Objective: errors from the SPA and the API reach Sentry without personal data, API errors carry their `requestId`, and new issues alert by email.
Branch: `feat/errores-sentry` · Delivery: `ask-on-risk` · Test runner: vitest in `apps/api`; vitest in `apps/web` too, plus a build check and the preview proof.

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
| T1 | S1, S3 | inline | done | `2bba009`; RED then GREEN, 57 API tests. Risk: item 5 |
| T2 | S1, S2, S5 | inline | written | SPA SDK, CSP, source maps in the deploy build, runbook; 3 web tests, build with and without token. Risk: items 2, 5 |
| T3 | S4 | stakeholder (secrets) | pending | Sentry account in the EU region, alert rule, DSN, CI token |
| T4 | S6 | after setup | pending | error provoked on a preview |

## Log

- L1 (2026-11-01, stakeholder): "continuemos con #26. Busca una alternativa free", then "continuemos con sentry" after comparing Sentry, PostHog and GlitchTip. The Developer plan is free: 5,000 errors, one user, email alerts. Whether signing up asks for a card is unconfirmed.
- L2 (assumptions): one Sentry project for both apps, because the quota is shared and it keeps setup to one DSN. EU data region, matching PostHog in ADR-0028; the region cannot be changed later. The API is compiled by `tsc` without minifying, so its stack traces are readable without uploading maps; only the SPA uploads them. The SPA has no API client yet, so S3 applies to API events until one exists. The S6 error is provoked from a throwaway branch, so no failing route is merged.
- L3 (2026-11-01): `sendDefaultPii` from S1 does not exist in SDK 11: `dataCollection` replaced it, and its defaults collect user data, cookies, headers and bodies. Both SDKs turn every option off, pinned by tests. The stack frames of an event quote source lines, so tests assemble their sample data at runtime.
- L4 (2026-11-01): `apps/web` gains vitest, because the scrubbing must not depend on a preview check. Build check: no token gives no maps; a fake token gets a 401, the build still succeeds and no `.map` remains. A failed upload does not stop a deploy, on purpose. The SPA bundle is 404 kB (130 kB gzip).
- L5 (2026-11-01): independent verifier, 3 blockers, all fixed here. B1: thrown non-Error objects reached `extra` unscrubbed in both SDKs. B2: the default Dedupe integration dropped repeated errors and their `requestId`. B3: custom React root handlers removed React's console output, even without a DSN. Also fixed from the advisories: `transaction` removed, `tracePropagationTargets` empty, runbook corrected. Recorded, not fixed: redaction covers four shapes only; oversized bodies report as 500; with a DSN an unhandled rejection no longer exits 1; cold import is slower by a few hundred ms. Verifier ran on Node 26, not 22. Unverified until T3/T4: env reaching `vercel build`, `VITE_VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` at runtime, token scopes.
- L6 (2026-11-01, stakeholder): "Revisar este cambio". The two stale-base candidates failed with `lens_context_budget_exceeded`; the review ran on the real candidate against main, with the risk, resilience and reliability lenses, and was approved and acknowledged with 11 non-blocking findings. The verifier recheck confirmed B1-B3 fixed, with one remaining difference: an uncaught React error logs `Error:` instead of the browser's `Uncaught Error:`.
- L7 (2026-11-01): fixed from those findings: empty `SENTRY_DSN`, `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` no longer crash the API at startup; a flush timeout logs `error report failed`; 4xx body parser failures are no longer reported, so they cannot spend the quota; unhandled rejections end the process as at the baseline. Recorded, not fixed: redaction covers four shapes only; a sustained server failure can spend the quota, since nothing samples it; React root handlers have no test.
