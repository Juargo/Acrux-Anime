RF-55: badges and Plus-only avatars (epic #50). Branch feat/insignias. Delivery: single PR; units with a high-risk item get their own commit.
Test runners: Vitest (api, web) and Playwright E2E.

## Specs

- S1 (RF-55, verbatim): "Plus desbloquea insignias e íconos."
- S2 (user decision, 2026-11-09): "Logros por hitos (Recomendado)". Badges are earned from what Acrux already measures: "100 títulos vistos, 1.000 horas, 10 géneros distintos, etc." Everyone sees which ones they earned. Plus shows them on the profile and the public card. A free user sees their progress as a preview, the same way stats do.
- S3 (user decision, 2026-11-09): "Avatares exclusivos Plus (Recomendado)". "Icons" means extra avatar presets, only for Plus, built on the existing avatarPreset. They show on the profile and the public card. Reason: a PWA cannot change its installed icon for one user.
- S4 (assumption): the badge catalog.
  - Titles seen: 10, 50, 100, 250.
  - Hours watched: 50, 200, 500.
  - Distinct genres among seen titles: 5, 10.
  - Values come from `computeStats` (RF-53), so they count only `seen` marks.
- S5 (assumption): storing badges.
  - `profile.badges` is a text[] with default `{}`.
  - The browser writes the earned ids with `PATCH /me {badges}`, the same as `shown` (ADR-0024). The API accepts only known ids, with no duplicates.
  - Badges are stored for free users too, so they appear as soon as the user buys Plus.
- S6 (assumption): where badges show.
  - `GET /me` always returns the user's own badges.
  - `GET /profiles/:handle` returns `badges` only when the owner is Plus; otherwise it returns `[]`.
  - The public profile and the share card show them when the owner is Plus.
- S7 (assumption): the badges screen.
  - Route `/perfil/insignias`, with a "Insignias" row in Perfil for everyone.
  - It lists every badge as earned or with its progress.
  - A free user also sees that Plus shows them on the public profile and the card, with "Ver Acrux Plus" (or `plus.soon` while billing is off).
- S8 (assumption): Plus avatars.
  - Three new presets: `sakura`, `aurora`, `eclipse`.
  - `PATCH /me` with one of them and no Plus answers 403 `plan.plus_required`.
  - On read (`GET /me`, `PATCH` response, public profile, OG image) a Plus preset of a user who is not Plus becomes null. The stored value is kept, so a refund hides it and a new purchase brings it back (RF-56). This follows the `withPlan` pattern of the `feat/temas-tarjeta` branch.
  - The picker shows the Plus presets locked for a free user, with a link to Plus.

## Tasks

- [x] T1 [S3, S8]: API Plus avatars. Migration `ALTER TYPE avatar_preset ADD VALUE`, PATCH 403, masking in me, public profile and OG. Route: inline. Risk: items 1 and 2. Commits 1ee0d9c plus the probes in d97b8aa. RED: 4 failing, then GREEN. API suite 330/330. The independent verifier passed S3 and S8 with no blockers.
- [x] T2 [S3, S8]: web Plus avatars. Avatar CSS and art, locked picker, i18n. Route: inline. Commit 4e6e679. RED: 3 failing, then GREEN. Web suite 354/354.
- [x] T3 [S2, S4, S5, S6]: API badges. Migration for the `badges` column, PATCH validation, GET /me, public profile only for Plus. Route: inline. Risk: item 1. Commit 14a274d, plus the probes in e5a5200. RED: 2 failing, then GREEN. API suite 339/339. The independent verifier passed S2, S4, S5 and S6 with no blockers.
- [x] T4 [S2, S4, S7]: web badges. Pure catalog and `computeBadges`, the `/perfil/insignias` screen with sync, the Perfil row. Route: inline. Commit 17a90dd. RED, then GREEN. Web suite 363/363.
- [x] T5 [S6]: badges on the public profile and the share card for Plus. Route: inline. Commit 24e2f88. RED: 2 failing, then GREEN. Web suite 366/366.
- [x] T6 [S1-S8]: RF-55.feature, an E2E journey, the requirements, the runbook and the Plus benefit text. Route: inline. Commit 2a39c3b. ADR-0040. E2E 18/18 on chromium and webkit, against a disposable postgres:17 that was migrated and then stopped. Typecheck passes in every package.

## Log

- L1 (2026-11-09, user): "sigamos con las insignias RF-55"
- L2 (2026-11-09, user):
  - Badges: "Logros por hitos (Recomendado)".
  - Icons: "Avatares exclusivos Plus (Recomendado)", after being told a PWA cannot change its installed icon for one user (web.dev manifest-updates).
- L3: explorer map.
  - The avatar list is copied by hand in 9 or more places: Prisma enum, API zod (profile, public-profile), API SVG colors, web type and array, CSS, i18n.
  - `requirePlan` exists, but no route uses it.
  - Per-field Plus pattern is on `feat/temas-tarjeta`: the handler reads the plan and throws 403, and `withPlan` masks the value on read.
  - The API stores only anilist ids. Hours and genres exist only in the browser, and the server trusts the `shownTotal` the client writes.
  - The public summary returns no plan.
  - The share card is built in the browser (html-to-image).
- L4: route declaration. Every unit runs inline: badges and avatars share profile/index.ts, schema.prisma, public-profile, i18n and styles.css, so they are not disjoint, and no writer trigger applies.
- L5: T1 verifier verdict: S3 PASS, S8 PASS, no blockers. Advisories:
  - A refund that lands between the plan read and the write could save a Plus preset. Masking hides it anyway.
  - The account export returns the user's own stored preset unmasked, which is acceptable.
  - The case and whitespace probes were committed as tests (d97b8aa).
- L6: `stats.seePlus` moved to `plus.seePlus`, because the stats, avatar and badge screens all share it.
- L7: T3 verifier verdict: S2, S4, S5 and S6 PASS, no blockers.
  - The migration is metadata-only (constant default).
  - Grants are table-level, so `acrux_api` already covers the new column.
  - og.ts does not read badges.
  - The validator probes were committed (e5a5200).
- L8: Badges are synced when the user opens Insignias. The card and the public profile show the last saved list (ADR-0040 consequence).
- L9: Risk lines.
  - T1: items 1 and 2 (migration; per-field Plus guard). Verified independently.
  - T3: item 1 (migration). Verified independently.
  - T2, T4, T5, T6: none. These are display-only, behind values the API already masks.
