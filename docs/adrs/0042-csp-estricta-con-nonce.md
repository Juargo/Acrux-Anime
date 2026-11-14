# ADR-0042: CSP estricta con nonce para el HTML de la app

- **Estado:** Aceptado
- **Fecha:** 2026-11-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-10 («hagamos la CSP con nonce»).

**Modifica:** ADR-0028, punto 5 (la CSP del documento ya no sale de `vercel.json`), y ADR-0016 (el HTML deja de estar en la caché del *app shell*). **Complementa:** ADR-0038.

## Contexto

- La app es una SPA estática en Vercel. Su CSP sale de `apps/web/vercel.json` y dice `script-src 'self'`.
- AdSense (ADR-0038) carga scripts de dominios que cambian con el tiempo. Google solo soporta una CSP estricta con nonce: «Because the domains that the AdSense ad code uses change over time, we only support strict CSP» ([AdSense Help](https://support.google.com/adsense/answer/16283098)). La política que recomienda es `object-src 'none'; script-src 'nonce-{random}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:; base-uri 'none'`.
- Un nonce tiene que ser distinto en cada pedido, así que el HTML ya no puede ser un archivo estático.
- La PWA guardaba el `index.html` en caché y lo servía sin pasar por la red (ADR-0016). Así el nonce quedaba fijo hasta la siguiente versión.

## Opciones

- **A. Nonce por pedido:** lo que soporta Google, pero el HTML pasa por una función.
- **B. Lista de dominios en la CSP:** Google no la soporta y puede romperse sin aviso.
- **C. `script-src https:`:** es simple, pero deja de proteger contra XSS.

Para la PWA, el stakeholder eligió **red primero**, frente a mantener el HTML en caché con un nonce fijo por versión.

## Decisión

**Opción A, con la PWA en red primero.**

1. Vite escribe el marcador `ACRUX_CSP_NONCE` en cada `<script>`, hoja de estilos y `modulepreload` del build (`html.cspNonce`).
2. La función `apps/web/api/html.ts` atiende todas las rutas de la SPA (la reescritura de `vercel.json`). Lee `html-template/index.html`, que viaja con la función por `includeFiles`, reemplaza el marcador por 16 bytes aleatorios en base64 y envía la CSP con `Cache-Control: private, no-cache`.
3. La CSP se arma en `apps/web/api/_csp.ts`:
   - `script-src 'nonce-…' 'strict-dynamic' 'self'`. `'strict-dynamic'` permite lo que carga el script principal (chunks diferidos y `adsbygoogle.js`); `'self'` solo sirve a navegadores sin CSP3.
   - `worker-src 'self'`, porque el registro del service worker no lleva nonce.
   - Mientras falte `VITE_ADSENSE_CLIENT` o `VITE_ADSENSE_SLOT`, el resto es igual que antes: `default-src 'self'`, la misma lista de `img-src` y `connect-src`, `object-src 'none'`, `frame-ancestors 'none'`.
   - Con ambas variables se agregan la política de Google en `script-src` (`'unsafe-inline' 'unsafe-eval' https:`, que los navegadores CSP3 ignoran salvo `'unsafe-eval'`) y `https:` en `img-src`, `connect-src`, `frame-src` y `fenced-frame-src`. También se agrega `'unsafe-inline'` en `style-src`. Google no publica una lista para esas directivas.
4. El build de Vercel mueve el documento de `dist/index.html` a `html-template/index.html` (`buildCommand`). Vercel sirve un archivo existente antes de aplicar las reescrituras, así que una copia pública respondía `/` y `/index.html` sin nonce (corregido el 2026-11-13). El `build` local no lo mueve, porque `vite preview` y las pruebas E2E lo necesitan en `dist`.
5. `vercel.json` conserva la CSP anterior para los archivos estáticos (`/assets`, `/sw.js`). En la respuesta de la función manda la cabecera de la función: Vercel da prioridad a las cabeceras de las funciones.
6. El service worker ya no precarga el HTML. Las navegaciones van a la red primero (`NetworkFirst`, 5 s) y, sin conexión, usan la última copia, guardada con una sola clave para todas las rutas.

## Consecuencias

- **Positivas:**
  - Un script inyectado en el HTML no se ejecuta sin el nonce (se comprobó en el navegador con un script inline, un `onerror` y un script externo).
  - La política estricta ya corre en producción antes de activar los anuncios.
- **Negativas / riesgos:**
  - Cada navegación pasa por una función en `gru1`, con un arranque en frío ocasional, y la primera pantalla de la PWA instalada ya no carga sin red.
  - Sin conexión, la última copia del HTML trae un nonce viejo. Sigue funcionando porque la CSP guardada es la de esa misma respuesta.
  - Con los anuncios activados, `https:` en imágenes, frames y conexiones amplía lo que un XSS podría enviar afuera. El nonce sigue impidiendo ejecutar scripts.
  - La URL de Neon Auth está en dos lugares: `apps/web/api/_csp.ts` y `apps/web/vercel.json`.
