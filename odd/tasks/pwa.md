# PWA instalable con aviso de nueva versión (#44)

Objective: make the web app an installable PWA that caches only the app shell (ADR-0016). Branch `feat/pwa`, single PR. Test runner: Vitest (`pnpm --filter @acrux/web test`).

## Specs

- S1. "`vite-plugin-pwa` con manifiesto e íconos de la marca" — manifest (name, icons including maskable, `display: standalone`, theme colors) and brand icons.
- S2. "Aviso «nueva versión» con botón para recargar" — `registerType: prompt`; the new service worker activates only when the user accepts (ADR-0016). Gherkin @CA-ADR16-01: "Dado que tengo la app instalada / Cuando se publica una versión nueva / Entonces veo un aviso con un botón para recargar".
- S3. "Sugerencia de instalación después de marcar el primer anime, descartable" — ADR-0016: Android `beforeinstallprompt` + own "Instalar Acrux" button; iOS instructions («Compartir» → «Agregar a pantalla de inicio»); once dismissed it never shows again (`localStorage`); hidden when already installed (`(display-mode: standalone)`) or when the browser cannot install.
- S4. "Verificar que el service worker no cachea respuestas de la API ni de AniList" — precache only the app shell; no runtime caching; `/api` excluded from the navigation fallback.

## Tasks

- [x] T1 (S1, S4) inline — plugin, manifest, icons, no-data-cache config. RED: pwa-options.test.ts failed (no module), then 3/3 green; built sw.js has only the navigation route (denylist /^\/api\//) and no anilist/posthog/neonauth URL.
- [x] T2 (S2) inline — update notice. RED: UpdateNotice.test.tsx failed (no module), then 3/3 green.
- [x] T3 (S3) inline — install suggestion. RED observed for InstallSuggestion, the entry-mark callback and the Home wiring; install.ts was written before its tests (no RED for installOffer/createInstallStore).

## Log

- L1 (2026-11-06): "si" — continue with the next H2 issue; the stakeholder chose "#44 PWA (Recommended)".
- L2: vite-plugin-pwa 2.0.0 (2026-10-03, peer vite ^8) and workbox-window 7.4.1, both past the 7-day quarantine. `pnpm audit --audit-level=high` passes. Icons generated from `public/icons/marca.svg` with `@vite-pwa/assets-generator@2.0.0` (one-off `pnpm dlx`, not a dependency).
- L3: English UI is not in scope here; texts are Spanish until #43 (i18n).
- L4: Trigger = a franchise saved as seen (Home wraps onFranchiseMarked) or one entry saved as seen (new onEntryMarkedSeen through the context). Both notices are fixed at the top so they never cover the consent banner. The service worker checks for a new version every hour.
- L5: Checks: web typecheck, Biome (only the 2 existing document.cookie warnings), 268 web tests, build (29 precache entries). Manual check pending: install on Android Chrome and iOS Safari, and the update flow on the preview (ADR-0016).
