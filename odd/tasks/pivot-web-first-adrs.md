# Feature: Pivot to web-first in the ADRs

## Objective

Record in the ADRs the stakeholder decision of 2026-10-12: the MVP is a responsive, mobile-first web app; native Android (Kotlin) and iOS (Swift) apps move to the future. Landing in Astro, web app in React.

## Problem / why

ADRs 0001, 0005 and 0011 (Accepted) and 0002–0004 (Proposed) assume an Expo mobile app published to the stores. The new direction contradicts them.

## Decisions taken (2026-10-12)

- Platform: responsive web app (mobile-first) for the MVP; native Kotlin and Swift apps later.
- Stack: React web app, Astro landing.
- 28-oct milestone: web app in production on Vercel with a public domain, usable by real users, with login and account deletion working.

## Constraints

- Accepted ADRs are not rewritten (docs/adrs/README.md): supersede them with new ADRs and update the old status.
- Proposed ADRs (0002–0004) can be edited directly.
- ADR artifacts are in Spanish (existing project language), neutral/professional register.

## Tasks

- [x] T1 — New ADR-0013 (platform: web first) superseding 0005 and the "web out of MVP" item of 0009; new ADR-0014 (milestone + sprint plan) superseding 0011 and the sprint plan of 0001. Update statuses of 0001, 0005, 0009, 0011.
- [x] T2 — Update proposed ADRs 0002, 0003, 0004 to the web stack and future native apps.
- [x] T3 — Update README index and traceability.

Route: delegated direct (writer trigger: 2+ non-trivial files). TDD: not applicable (documentation only). Review: passive docs → structural readback.

## Acceptance criteria

- No remaining ADR in force states Expo/EAS or store publication as the MVP path.
- Superseded ADRs keep their content and only change status.

## Progress / evidence

- Branch: docs/pivot-web-first
- T1–T3 done by delegated writer; structural readback: all Estado lines correct, README links resolve (0000–0014); remaining Expo mentions only in Accepted bodies (0001, 0006) or discarded options.
- Review: passive documentation, structural readback only.
- 2026-10-12: stakeholder accepted React + Vite + React Router (SPA) over Next.js; recorded in ADR-0003.
- 2026-10-12: domain acruxanime.com bought; landing at apex, web app at app.acruxanime.com; recorded in ADR-0004 (Dominios) and ADR-0014 open question resolved.
- 2026-10-12: login only with Google in the web MVP; Apple deferred to native iOS. New ADR-0015 (partially supersedes ADR-0007; account deletion stays).
- 2026-10-12: installable PWA with app-shell cache only, no offline data (D14 kept). New ADR-0016; 0013 open question resolved; vite-plugin-pwa added to 0003.
- 2026-10-12: PWA updates via "new version" prompt with reload button (registerType prompt); recorded in ADR-0016.
- 2026-10-12: Biome accepted for lint and format (over ESLint + Prettier); recorded in ADR-0003.
- 2026-10-12: catalog is a live query to the official MyAnimeList API v2 (no seeding, only the MAL id of seen animes is stored); ADR-0008 accepted, 0003/0004/0009/0014 updated; filters and CORS to be validated in a Sprint 0 spike.

- 2026-10-12: Playwright accepted as minimal E2E smoke suite (mobile viewport, Chromium + WebKit, MAL mocked via page.route, test session created via Supabase); recorded in ADR-0003.
- 2026-10-12: PWA install hint shown at the moment of value (after first anime marked), dismissible, hidden when installed; recorded in ADR-0016.

- 2026-10-12: MAL app registered (Client ID kept out of the repo). mal-proxy Edge Function made mandatory to keep the Client ID secret (MAL forbids disclosure) and avoid CORS; recorded in ADR-0008/0004 (+0002/0003/0014).

- 2026-10-12: catalog visible only with an active session; mal-proxy requires role authenticated (anon key rejected); recorded in ADR-0008.

## Next step

All ADR open questions from this session resolved. PR opened: https://github.com/Juargo/Acrux-Anime/pull/1 (merge is the stakeholder decision). Next: Sprint 0 MAL API spike (filters + CORS, ADR-0008) once the stakeholder has the Client ID.
