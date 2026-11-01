# Feature: deployment pipeline (issue #24)

Objective: production of `app` only through GitHub Actions after CI passes on `main`: migrations, prebuilt deploy, smoke test and automatic rollback; weekly ZAP baseline.
Branch: `ci/pipeline-de-despliegue` · Delivery: `ask-on-risk` · Test runner: actionlint (workflows cannot run locally); end-to-end proof on the first run after merge.

## Specs

- S1 (issue #24): "`deploy.yml` en `main`: calidad + pruebas + build → `prisma migrate deploy` → `vercel deploy --prod` → humo → `vercel rollback` si falla".
- S2 (issue #24): "Desactivar la publicación automática de producción desde Git en Vercel".
- S3 (issue #24): "Entorno `production` en GitHub con aprobación para los flujos con secretos". GitHub already has `Production` environments created by the Vercel integration and environment names are case-insensitive, so this one is `deploy-production`.
- S4 (issue #24): "`weekly.yml`: ZAP *baseline* contra la vista previa de `main`". Previews are behind Vercel Authentication and `main` no longer gets previews, so the passive baseline scans production.
- S5 (issue #24): "`DATABASE_URL_UNPOOLED` (rol propietario) de cada rama de Neon como secreto de GitHub para las migraciones; no va en Vercel (viene de #22)". Only production migrates from Actions, so the secret holds the `production` branch.
- S6 (acceptance): "Una migración fallida no publica el código".
- S7 (acceptance): "Un humo fallido revierte la producción".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S2, S4, S6, S7 | inline | done (e8138e2) | `deploy.yml` (after CI via `workflow_run`), `weekly.yml`, `git.deploymentEnabled.main: false` |
| T2 | S3, S5 | stakeholder (secrets) | done | environment `deploy-production` with reviewer, `VERCEL_TOKEN`, `DATABASE_URL_UNPOOLED`, vars `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| T3 | S6, S7 | after merge | done | S7 proven in production (runs 41270353821, 41270566929); S6 by step order, see L6 |

## Log

- L1 (2026-10-31, stakeholder): "si" to continuing with #24.
- L2: The deploy job reuses CI through `workflow_run` instead of duplicating its steps; calling ci.yml with `workflow_call` would share its concurrency group with the caller. `vercel rollback` needs a target, so the job records the current production deployment (`vercel inspect app.acruxanime.com`) before deploying.
- L3: actionlint clean on all workflows. Gentle AI review (risk, resilience) ran both lenses but STATUS stopped with `corrupted_or_unverifiable_authority` (terminal, no automatic continuation); manual check of trigger, secret scope, script injection and step order recorded instead.
- L4 (2026-10-31): the stakeholder created a Vercel token scoped to the `app` project only (the UI offered project scopes) and ran `setup-deploy-env.sh`. Verified: environment `deploy-production` with required reviewer Juargo and protected branches only; secrets `VERCEL_TOKEN`, `DATABASE_URL_UNPOOLED` (Neon `production`); vars `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (prj_3fp2TvApAzFsHWFecSyqLGuSr4Vv).
- L5: Second review (risk, resilience). Finding R4-001 (CRITICAL, resilience): after an Instant Rollback Vercel stops assigning the production domain to new deployments, so a later deploy could pass the smoke test against the old one. Correction 627e499: capture the deployment URL, `vercel promote` it and fail unless `app.acruxanime.com` resolves to it. The targeted validator returned no verdict (no command tool to inspect the frozen trees). Stakeholder chose to continue without it (2026-10-31); manual check: no `defaults`, job `env` unchanged, the promote step sits between deploy and smoke so the rollback condition covers it.
- L6 (2026-11-01): end-to-end proof on `e4e3b61`, production `app.acruxanime.com`. Run 41167118935 (normal deploy): success, rollback skipped. Run 41270353821 (`simulate_smoke_failure=true`): new deployment `dpl_9H6qcS5H4M8wQxKmbp7aUzNX9WCa` served production, smoke failed, rollback step succeeded, and `vercel inspect` showed the domain back on the previous `dpl_9jKEXEquufGZFgYwXqpnsh57M4Et`. Run 41270566929 (normal deploy after the rollback): `dpl_46eF2jHx2A11yGjdbjiiNCajF9DT` promoted and serving, confirming the R4-001 correction; `/` and `/api/health` return 200. S7 is proven. S6 was not exercised with a real failed migration, which would mean breaking production on purpose: its evidence is the step order (migrations before build and deploy, no `continue-on-error`) and run 41164413558, where a step after migrations failed and `Deploy` was skipped. The automated ZAP run in `weekly.yml` (S4) has not run yet; its first schedule is Monday 09:00 UTC.
