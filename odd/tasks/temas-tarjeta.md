RF-52: card themes unlocked by Plus (epic #50). Branch feat/temas-tarjeta, single PR.
Test runner: Vitest (api with Testcontainers, web with jsdom) and Playwright E2E.

## Specs

- S1 (RF-52, verbatim): "Plus desbloquea plantillas y temas extra de tarjeta. Antes de pagar, el usuario prueba el tema en su propia tarjeta con marca de agua."
- S2 (user decision, 2026-11-09): "Solo Neón ahora". Clásica is free and Neón needs Plus. Manga is left out until it has a design, and is tracked in docs/deuda-tecnica.md.
- S3 (Figma M07/M20/D20/M22, Flujo 5):
  - Theme chips go under the card: `Clásica`, `🔒 Neón`.
  - A free user who picks Neón sees their own card in Neón with the watermark "VISTA PREVIA".
  - The CTA reads "El tema Neón es de Plus" / "Tu tarjeta básica sigue siendo gratis.", with the buttons "Ver Acrux Plus" and "Seguir con Clásica". It is a sheet on mobile and a bar on desktop.
  - After the purchase, "Tu tema Neón ya está aplicado." (M22, F2 "se aplica lo que intentaba usar").
- S4 (assumption, ADR-0025, 02-usuarios-y-roles):
  - The theme is stored on the account. Only Plus can save a theme other than Clásica (403 `plan.plus_required`).
  - Without Plus, the effective theme is Clásica, so a refund falls back without rewriting data (RF-56).
  - The plan is never taken from the client.
- S5 (assumption):
  - Sharing and downloading always use the effective theme. A free user never exports the watermarked preview, so Compartir and Descargar are disabled during the preview.
  - The public profile and og.png do not change.

## Tasks

- [x] T1 [S2, S4] API: `card_theme` enum and column (additive migration), `cardTheme` in GET and PATCH `/me`, plan check. Route: inline. Risk: items 1 and 2. Commit a18c961; API suite 329/329.
- [x] T2 [S1, S3, S5] Web: ShareCard theme and watermark, chips, CTA, export rules, i18n. Route: inline. Web suite 342/342.
- [x] T3 [S3] Apply the chosen theme after the purchase (M22), plus RF-52.feature, E2E, runbook and deuda técnica (Manga). Route: inline. Web 344/344, E2E 16/16 (chromium + webkit).

## Log

- L1 (2026-11-09, user): "deja todo los pendientes en deuda técnica para antes del lanzamiento. Continuemos con los pasos que indicas #50"
- L2 (2026-11-09, user): Manga → "Solo Neón ahora (Recommended)".
- L3: Explorer map. ShareCard (`apps/web/src/components/ShareCard.tsx`) has no theme. The PNG comes from html-to-image of the DOM node (`apps/web/src/card/image.ts`). Profile has no theme field. Figma Neón instances are 43:2627 (D20) and 42:2555 (M20).
- L4: The Neón colors are approximated from the Figma M20 preview (magenta #ff4fb8 to cyan #3ee0f0 border; #5a2468 to #1d5a66 background). The CTA uses D20's short copy and does not promise stats or Wrapped. The chips are native radios (Biome useSemanticElements).
- L5: E2E order ids collided across Playwright workers because both seeded from the same second, so the second order answered `duplicate`. Each worker now seeds from Date.now()*1000 plus randomInt. The E2E server serves the built dist, so run `pnpm --filter @acrux/e2e build:apps` first.
