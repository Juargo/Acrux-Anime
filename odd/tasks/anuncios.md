RF-58 and RF-59: AdSense ads for free users, with a switch and separate consent (epic #50, ADR-0038). Branch feat/anuncios, single PR.
Test runners: Vitest (web, landing) and Playwright E2E.

## Specs

- S1 (RF-58, verbatim): "El usuario gratuito ve anuncios no intrusivos que no tapan contenido. Nunca aparecen en la tarjeta compartida, en el perfil público, en el inicio de sesión ni en el borrado de cuenta. La red es Google AdSense y los espacios son Inicio, Mi lista, la ficha de franquicia y la pantalla de tarjeta, siempre fuera de la tarjeta."
- S2 (RF-59, verbatim): "Plus quita todos los anuncios en cualquier navegador o dispositivo donde el usuario inicie sesión." ADR-0038 point 6: "Plus no carga el script de AdSense (RF-59)."
- S3 (user decision, 2026-11-10): "Dos opciones separadas (Recomendado)".
  - The banner asks separately for "Analítica" and "Anuncios personalizados", with Aceptar todo, Rechazar todo and Elegir.
  - In Perfil, each choice can be changed on its own.
- S4 (assumption): the switch.
  - Ads exist only when `VITE_ADSENSE_CLIENT` (ca-pub-…) and `VITE_ADSENSE_SLOT` are set.
  - Without them nothing loads, no slot renders, and the consent banner stays exactly as today (analytics only).
  - This mirrors billing, which stays off without `LEMON_SQUEEZY_*`.
- S5 (assumption): loading.
  - The AdSense script is injected once, when the first slot of a free user mounts. A Plus user never mounts a slot, so the script never loads.
  - The slot is shown only when the plan is known to be free (`plan === 'free'` from `/me`).
- S6 (assumption): consent for ads.
  - Stored in localStorage under `acrux:ads-consent` (granted, denied or undecided), per device, like analytics (ADR-0028).
  - Without a grant, AdSense gets `requestNonPersonalizedAds = 1` before each request (ADR-0038 point 5).
  - In the EU, UK and Switzerland, Google's TCF CMP (set up in the AdSense console) decides for ads.
- S7 (assumption): what a slot looks like.
  - An `aside` labelled "Publicidad", with a small visible "Publicidad" label and reserved height, so it never covers content and the layout does not jump.
  - Placement:
    - Inicio: after the filters.
    - Mi lista: between the stats and the tabs.
    - Ficha: after the status block.
    - Tarjeta: after the actions, outside the `<figure>`.
  - There is no slot in any other screen.
- S8 (assumption): privacy policy (landing).
  - AdSense (Google) is added as a processor in Spanish and English.
  - The policy explains that outside the EU, UK and Switzerland AdSense may set cookies for frequency and fraud even without consent (ADR-0038).
- S9 (pending decision, not built): CSP for AdSense. Google supports only a strict nonce-based script-src, not a domain allowlist (support.google.com/adsense/answer/16283098). The CSP in `apps/web/vercel.json` stays as it is, and the decision is recorded for activation time.

## Tasks

- [x] T1 [S3, S4, S6]: ads consent store and banner with two choices; the "Anuncios personalizados" row in Perfil. Route: inline. Commit 086f2ae. RED: 4 failing, then GREEN. The existing banner tests pass unchanged without AdSense. Web 373/373.
- [x] T2 [S2, S4, S5, S6, S7]: AdSense loader, `AdSlot` and the env switch. Route: inline. Commit 71346f6. RED (missing module), then GREEN, 6 tests.
- [x] T3 [S1, S2, S7]: slots in the four screens, and none in the excluded ones. Route: inline. Commit 77b2578. Without the slots, 3 placement tests fail. Web 389/389.
- [x] T4 [S8, S9]: privacy policy (landing), runbook `docs/runbooks/anuncios.md`, RF-58 and RF-59 .feature files, technical debt. Route: inline. Commit 17046b1. Landing 26/26. check-tags shows every RF-58 and RF-59 criterion covered.

## Log

- L1 (2026-11-10, user): "continuemos con la monetización por anuncios"
- L2 (2026-11-10, user): consent is "Dos opciones separadas (Recomendado)".
- L3: explorer map.
  - Consent lives in localStorage `acrux:analytics-consent`, per device, with no server sync. The banner is mounted at the root, outside the router.
  - Only CardScreen reads the profile.
  - Delete-account sits inside the signed-in tree, so no slot may go in the shared Home layout.
  - The CSP has `script-src 'self'` and no `frame-src`.
  - The privacy policy is in `apps/landing/src/legal.ts`.
- L4: Google does not support a domain allowlist for the AdSense CSP, only a strict nonce-based policy (support.google.com/adsense/answer/16283098; docs.report-uri.com/platforms/google-adsense). A static SPA has no per-request nonce, so the CSP needs a security decision at activation (S9). The rest is built behind the switch.
- L5: route declaration. All tasks run inline. The banner, slot and screens share the ads context, so they are not independent units, and no writer trigger applies.
- L6: ADR-0038 excludes ads on loading and error screens. So the slots in Inicio and the franchise detail render only once content is loaded, not while it is pending or failing.
- L7: The privacy policy uses "cuando activemos los anuncios", because the landing ships with main and ads are still off.
- L8: Risk: none.
  - Everything is behind the switch, which is off.
  - No CSP, header or API change.
  - Consent stays per device, as with analytics.
  - The S9 CSP decision is deferred to activation (runbook).
