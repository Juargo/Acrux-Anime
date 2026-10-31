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
| T1 | S1, S2, S4, S6, S7 | inline | pending | `deploy.yml` (after CI via `workflow_run`), `weekly.yml`, `git.deploymentEnabled.main: false` |
| T2 | S3, S5 | stakeholder (secrets) | pending | environment `deploy-production` with reviewer, `VERCEL_TOKEN`, `DATABASE_URL_UNPOOLED`, vars `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| T3 | S6, S7 | after merge | pending | first deploy run; rollback proof |

## Log

- L1 (2026-10-31, stakeholder): "si" to continuing with #24.
- L2: The deploy job reuses CI through `workflow_run` instead of duplicating its steps; calling ci.yml with `workflow_call` would share its concurrency group with the caller. `vercel rollback` needs a target, so the job records the current production deployment (`vercel inspect app.acruxanime.com`) before deploying.
