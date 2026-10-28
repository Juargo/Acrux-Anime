# Feature: Base architecture ADRs (0019–0030)

## Objective

Record the base architecture decisions of 2026-10-27 with a near-zero budget: architecture style, deployment topology, maintainability/scalability, database, API style, catalog source, authn/authz, consolidated stack, CI/CD, security/privacy by design, testing pyramid + acceptance criteria, KPIs and logs.

## Decisions taken (2026-10-27)

- Hosting: Vercel Hobby → Pro before the first Plus charge; API on the same origin (`app.acruxanime.com/api`), replacing Render.
- DB + Auth: Supabase (Postgres + Google). Data access: Prisma (RLS enabled without policies as defense in depth).
- Catalog: AniList queried directly from the browser (replaces the MAL proxy of 0008/0018).
- Observability: PostHog + Sentry.
- Acceptance criteria: Gherkin (Spanish), no Cucumber runner.
- Privacy scope: Chilean law + basic GDPR.

## Tasks

- [x] T1 — New ADRs 0019–0030.
- [x] T2 — Update statuses of 0003, 0004, 0008, 0017, 0018 and the README index/traceability.
- [x] T3 — Stakeholder accepted 0019, 0021, 0023, 0026, 0027, 0028 (only change requested: web only). 0028: deletion deadline immediate in DB / backups on expiry; rate-limit store chosen at implementation.
- [x] T4 — ADR-0031 supersedes ADR-0014 (validate first, no fixed date) and the native phase of ADR-0013 (web only).
- [x] T5 — Applied: public repo (backups to private R2 bucket, no Actions artifacts), São Paulo region, private list by default; removed native-app rationale from 0020/0023/0026.

## Progress / evidence

- Branch: pending (files written to the working tree on `main`, not committed).
