# Feature: weekly encrypted backup (issue #25)

Objective: an unattended weekly `pg_dump` of production, encrypted with `age` and stored in a private Backblaze B2 bucket, with a tested restore and a runbook.
Branch: `feat/respaldo-semanal` · Delivery: `ask-on-risk` · Test runner: vitest + testcontainers for the role; actionlint, shellcheck and a stubbed run for the job; end-to-end proof after merge.

## Specs

- S1 (issue #25): "Bucket privado en Cloudflare R2 con regla de expiración a 4 semanas". ADR-0032 replaced the 4 weeks: "Los respaldos se conservan **30 días** y la regla de expiración del bucket se configura en 30 días". ADR-0035 replaced R2 with Backblaze B2 (L7).
- S2 (issue #25): "Job semanal: `pg_dump` → cifrado con `age` → subida a R2; la clave privada fuera del repo y de Actions". The destination is now B2 (L7).
- S3 (issue #25): "Probar una restauración en el proyecto de desarrollo y documentarla en un runbook". ADR-0034 replaced the development project with Neon branches, so the restore targets a temporary branch.
- S4 (issue #25): "El repo es público: el respaldo nunca se guarda como artefacto de Actions".
- S5 (acceptance): "Hay un respaldo de menos de 7 días en R2".
- S6 (acceptance): "La restauración de prueba funciona".
- S7 (stakeholder, L2): the job authenticates as a read-only role `acrux_backup`, in an environment `backup-production` without required reviewers, limited to `main`.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S7 | stakeholder | done | L5 |
| T2 | S7 | inline | written | migration and role tests green (25); removing BYPASSRLS fails the dump test. Risk: item 2 |
| T3 | S2, S4, S7 | inline | written | `backup.yml`, `backup-database.sh`; shellcheck, actionlint, stubbed run. Risk: items 2, 5 |
| T4 | S3 | inline | written | `docs/runbooks/respaldos.md`; steps unproven until T6 |
| T5 | S1, S7 | stakeholder (secrets) | pending | Backblaze DPA, bucket, lifecycle rule, application key, `age` keys, environment, role password |
| T6 | S3, S5, S6 | after merge | pending | first backup run; restore proof |

## Log

- L1 (2026-11-01, stakeholder): "continuemos con #25".
- L2 (2026-11-01, stakeholder): "si" to the read-only role over reusing the owner credential or approving each week. `deploy-production` requires a reviewer, so a scheduled job there would wait for a human.
- L3: Neon runs PostgreSQL 18 and `pg_dump` refuses a newer server, so the job installs the PGDG client 18. `pg_dump` turns `row_security` off and errors when RLS would hide rows, and every table has RLS, so the role needs `BYPASSRLS`. Neon documents that attribute on `neon_superuser`, not whether its members can grant it; T1 checks that first. If they cannot, the fallback is one read-only policy per table and `pg_dump --enable-row-security`.
- L4: Stubbed run of `backup-database.sh`: success uploads one object; a failing `pg_dump` exits 7 with no upload, because the object is uploaded only after the pipeline ends. No committed test: the repo has no shell test runner, and the real proof is T6.
- L5 (2026-11-01): the stakeholder ran the check in the Neon SQL Editor: `neondb_owner` has `rolbypassrls = t`, and `CREATE ROLE ... BYPASSRLS` plus `GRANT pg_read_all_data` both succeeded, so the migration stands and the fallback in L3 is not needed. The screenshot shows the compute, not the branch name; the role and attributes are the same on every branch.
- L6 (2026-11-01): native review declined by the stakeholder for this candidate, and for the two stale-base candidates of the stop hook. Independent verifier: one blocker, fixed here: `openssl rand -base64` can yield `/`, which breaks the libpq URI and prints part of the password in public logs, so the runbook uses `-hex`. Removed the empty-file check (`age` output is never empty). Advisories recorded, not fixed: a weekly cron cannot keep S5 strictly under 7 days at every moment, it is a point-in-time check; a size mismatch leaves the object in the bucket; the role can create temp tables and large objects through PUBLIC defaults, with no route into application tables. Tests still use Postgres 17; the verifier ran the restore on local Postgres 18.
- L7 (2026-11-01, stakeholder): "Necesito una alternativa completamente gratuita por ahora", then "si, dale con Backblaze". Enabling R2 asks for a card or PayPal. ADR-0035 moves the backups to Backblaze B2, on branch `feat/respaldo-backblaze`. The lifecycle rule hides at 28 days and deletes one day later, because the rules do not run in real time. The privacy policy now names Backblaze; the stakeholder must accept its DPA before the first backup.
