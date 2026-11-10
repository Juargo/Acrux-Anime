# CSP estricta con nonce (anuncios, ADR-0038)

Objetivo: servir el HTML de la app con una CSP con nonce por pedido, como exige AdSense. Rama `feat/csp-nonce`. Entrega: `single-pr`. Runner: Vitest (`pnpm --filter @acrux/web test`).

## Specs

- **S1.** Pedido del stakeholder: «hagamos la CSP con nonce». AdSense solo soporta una CSP estricta con nonce (https://support.google.com/adsense/answer/16283098). La política que recomienda es `object-src 'none'; script-src 'nonce-{random}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:; base-uri 'none'`.
- **S2.** Cada navegación de la SPA recibe un HTML con un nonce nuevo y una CSP cuyo `script-src` lleva ese nonce y `'strict-dynamic'`. El nonce va en cada `<script>` y en cada `<link rel="modulepreload">` del HTML. El resto de las cabeceras de seguridad (#73) se mantiene.
- **S3.** Mientras falte `VITE_ADSENSE_CLIENT` o `VITE_ADSENSE_SLOT`, las demás directivas quedan como hoy: `default-src 'self'`, la misma lista de `img-src` y `connect-src`, `frame-ancestors 'none'`. Con ambas variables, la CSP agrega lo necesario para los anuncios (`'unsafe-eval'` y orígenes `https:` en scripts, imágenes, frames y conexiones).
- **S4.** Decisión del stakeholder sobre la PWA: «Red primero (Recomendado)». Con conexión, cada navegación pide el HTML a la función y recibe un nonce nuevo. Sin conexión se usa la última copia guardada.
- **S5.** `/api/*`, `/assets/*` y la página para crawlers de `/@handle` no cambian de comportamiento.
- **S6.** La documentación refleja el cambio: un ADR para la CSP, el runbook de anuncios (punto 4 resuelto) y los requisitos o ADR que describen la CSP.

## Tasks

| ID | Specs | Ruta | Estado | Commit |
|---|---|---|---|---|
| T1 | S1, S2, S3, S5 | inline | hecho | 7c43b13 |
| T2 | S4 | inline | hecho | 9aef524 |
| T3 | S6 | inline | hecho | (este commit) |
| T4 | S1–S5 | verificador independiente (riesgo ítems 2 y 5) + vista previa | pendiente | — |

## Log

- **L1 (2026-11-10):** «hagamos la CSP con nonce».
- **L2 (2026-11-10):** Respuesta a «¿qué hacemos con las navegaciones?»: «Red primero (Recomendado)».
- **L3:** Diseño:
  - Vite `html.cspNonce` pone un marcador en las etiquetas.
  - Una función de Vercel, `api/html.ts`, lee `dist/index.html` (con `includeFiles`), reemplaza el marcador por un nonce aleatorio y envía la CSP.
  - La regla de reescritura del fallback de la SPA apunta a la función.
  - Según la documentación de Vercel, las cabeceras de la función tienen prioridad sobre las de `vercel.json`. Hay que comprobarlo en la vista previa con `curl -I`.
  - Se descartó el middleware: tendría que volver a pedir el HTML y eso choca con la protección de las vistas previas.
- **L4:** T1 y T2:
  - Web: 398 tests; typecheck y biome ci pasan.
  - En Chromium, sirviendo `dist` con el handler: la app monta, el service worker se registra y no hay avisos de CSP.
  - Con un script inline, un `onerror` y un script externo inyectados en el HTML, los tres quedan bloqueados por la CSP.
  - Los tests se escribieron junto con el código, sin RED previo.
