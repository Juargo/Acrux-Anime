# ADR-0003: Stack tecnológico

- **Estado:** Propuesto (varias capas ya decididas en ADRs propios)
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (supuesto S3), Reunión 002 (D8), Reunión 005 (D18), Sesión con el stakeholder 2026-10-12

## Contexto

Este ADR reúne la visión completa del stack. Las capas que ya se decidieron tienen su propio ADR; aquí se registran las que todavía están abiertas y la coherencia del conjunto. La sesión del 2026-10-12 cambió la plataforma del MVP a una web app (ADR-0013), por lo que esta versión reemplaza la propuesta anterior basada en Expo.

Criterios:

1. **Plazo de 18 días:** tecnologías que el desarrollador ya conoce y con poca configuración.
2. **Web responsive mobile first** (ADR-0013).
3. **Un solo lenguaje** (TypeScript) en todo el monorepo (ADR-0002).
4. **Costo bajo:** capas gratuitas de los servicios gestionados.
5. **Despliegue continuo** sin pasos manuales: Vercel construye y publica en cada cambio.

## Resumen del stack

| Capa | Elección | Estado | Referencia |
|---|---|---|---|
| Lenguaje | TypeScript | Propuesto | Este ADR |
| Web app | **React + Vite + React Router (SPA)** | **Aceptado** (decidido por el stakeholder el 2026-10-12) | Este ADR |
| Landing page | **Astro** | **Aceptado** (decidido por el stakeholder el 2026-10-12) | ADR-0012 |
| Hosting | Vercel (web app y landing) | **Aceptado** (landing, D18) / Propuesto (web app) | ADR-0012 |
| Backend (Auth, base de datos, funciones) | Supabase | **Aceptado** (D8) | ADR-0006 |
| Autenticación | Solo Google vía Supabase Auth en el MVP web; Apple con la app iOS futura | **Aceptado** | ADR-0007, ADR-0015 |
| Fuente del catálogo | API oficial de MyAnimeList v2, en vivo | **Aceptado** | ADR-0008 |
| Internacionalización | Español e inglés desde el inicio | **Aceptado** (D13) | ADR-0010 |
| Gestión del monorepo | pnpm workspaces | Propuesto | ADR-0002 |
| Apps nativas | Kotlin (Android) y Swift (iOS) | Futuro (fuera del MVP) | ADR-0013 |

## Capas abiertas: opciones consideradas

### Web app

| Opción | Comentario |
|---|---|
| **React + Vite + React Router (SPA)** (aceptado) | Arranque y compilación rápidos; sin SEO que resolver detrás del login, y la parte pública es la landing en Astro; despliegue estático simple en Vercel; el SDK de Supabase funciona sin adaptaciones (sesión en el navegador) y encaja con la topología sin servidor propio (ADR-0004). |
| Next.js | Más funciones (SSR, Server Components, rutas de servidor), pero innecesarias para una app autenticada; la sesión de Supabase pasa a cookies (`@supabase/ssr`) y suma una capa de servidor; más conceptos y más superficie para el plazo. |
| Astro con islas de React | Un solo framework para landing y app, pero la app es muy interactiva (lista grande, estado del cliente) y encaja mejor como SPA. |

### Librerías propuestas para la web app (a confirmar en el Sprint 0)

| Necesidad | Propuesta | Motivo |
|---|---|---|
| Enrutamiento | React Router | Estándar para una SPA con Vite. |
| Lista grande del catálogo (R6) | TanStack Virtual | Virtualización de filas con buen rendimiento en listas largas, también en teléfonos. |
| Datos remotos y paginación | TanStack Query | Caché, paginación infinita y reintentos sobre la API de MAL (siempre vía la Edge Function `mal-proxy`) y el cliente de Supabase; agrupa y cachea las consultas por id (ADR-0008). |
| i18n | i18next + react-i18next, con detección del idioma del navegador | Textos en archivos por idioma; inglés por defecto (ADR-0010). |
| PWA instalable | `vite-plugin-pwa` (manifiesto y service worker con Workbox) | Caché solo del *app shell*; sin datos en caché (ADR-0016). |
| Imagen para compartir | `html-to-image` + Web Share API, con descarga de la imagen como alternativa | Se genera en el navegador a partir de un nodo del DOM; sin servidor. Hay que probar en iOS Safari y Android Chrome. |
| Login con Google | Flujo OAuth con redirección de Supabase Auth (`signInWithOAuth`) | Sin SDK nativos; Apple queda para la app iOS (ADR-0015). |

### Landing page

Decidido por el stakeholder el 2026-10-12: **Astro**. Sitio estático, muy liviano, ideal para páginas de texto (privacidad, soporte). Descartadas: Next.js (excesivo para pocas páginas estáticas) y HTML estático (sin i18n ni componentes).

### Calidad y CI

| Necesidad | Propuesta |
|---|---|
| Lint y formato | **Biome** (aceptado el 2026-10-12): una sola herramienta y un solo `biome.json` en la raíz del monorepo para lint y formato. Descartado ESLint + Prettier: más ecosistema de plugins, pero dos herramientas, más configuración y más lento; lo que se pierde (soporte parcial de `.astro`, plugins específicos como el de TanStack Query) pesa poco en el MVP. |
| Pruebas unitarias | Vitest (integra con Vite) |
| Pruebas de componentes | Testing Library |
| Pruebas E2E de humo | **Playwright** (aceptado el 2026-10-12): 3 o 4 pruebas de los flujos críticos del hito (buscar → marcar como visto → contador, borrado de cuenta, aviso de nueva versión de la PWA) en viewport de teléfono, con Chromium y WebKit (motor de Safari en iOS). La API de MAL se intercepta con `page.route()` y datos fijos; la sesión de prueba se crea directo contra Supabase, sin pasar por la pantalla de Google (que bloquea logins automatizados). |
| CI | GitHub Actions: lint, typecheck y pruebas unitarias en cada PR; Playwright contra la vista previa de Vercel de cada PR |

### Apps nativas (futuro)

Las apps de Android (Kotlin) e iOS (Swift) quedan fuera del MVP (ADR-0013) y usarán los SDK oficiales de Supabase para cada lenguaje. Como Kotlin y Swift no consumen paquetes de TypeScript, el **contrato compartido será el esquema de Supabase** (migraciones y políticas RLS) y, posiblemente, los textos de i18n exportados como JSON. Los tipos de `packages/shared` solo sirven a las piezas en TypeScript.

## Decisión

**Web app: aceptada** con React + Vite + React Router (SPA); ver «Decisión sobre la web app (2026-10-12)». **Pendiente** para el resto de las capas abiertas. Propuesta del conjunto: **TypeScript + React (Vite, React Router, TanStack Query y Virtual, i18next) para la web app, Astro para la landing, ambos en Vercel, y Supabase como backend**. Las apps nativas en Kotlin y Swift quedan como fase futura.

## Consecuencias (si se acepta)

- **Positivas:** un solo lenguaje y un solo despliegue continuo; sin firma de binarios ni envío a tiendas; la landing y la app pueden compartir los textos de i18n.
- **Negativas / riesgos:** dependencia de Vercel y Supabase (límites de las capas gratuitas); rendimiento de una lista de ~40.000 elementos en teléfonos de gama baja; las apps nativas futuras no reutilizarán código TypeScript.
- **Acciones derivadas:** crear la web app con Vite y la landing con Astro dentro del monorepo y conectar ambas a Vercel en el Sprint 0.

### Decisión sobre la web app (2026-10-12)

El stakeholder aceptó **React + Vite + React Router como SPA**. El SEO lo cubre la landing en Astro y la web app vive detrás del login, por lo que el render en servidor no aporta valor en el MVP.

**Condición de revisión:** si entra al alcance un perfil público compartible con vista previa en redes (Open Graph), se necesita render en servidor para esas páginas. Se resolvería con una función puntual o desde Astro, sin migrar la web app a Next.js; si eso no alcanza, se registra un ADR nuevo.

## Preguntas abiertas

- ~~Elegir linter y formateador: ESLint + Prettier o Biome.~~ Resuelto el 2026-10-12: Biome.
- ~~¿Se incluye Playwright en el MVP o solo pruebas con Vitest y Testing Library?~~ Resuelto el 2026-10-12: Playwright con un conjunto mínimo de pruebas de humo.
