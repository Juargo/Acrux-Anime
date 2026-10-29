# ADR-0026: Stack tecnológico consolidado

- **Estado:** Aceptado (filas de ORM, base de datos y autenticación reemplazadas por ADR-0034)
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27

**Reemplaza:** ADR-0003 (Propuesto), cuyo resumen quedó desactualizado con el cambio a AniList (ADR-0024), el despliegue en Vercel (ADR-0020) y los pagos con Lemon Squeezy.

## Contexto

ADR-0003 reunía el stack con MyAnimeList como catálogo y la API en Render. Desde entonces cambiaron la fuente del catálogo, el hosting y el modelo de cobro. Este ADR consolida el stack vigente en una sola tabla. Los criterios se mantienen: tecnologías que el desarrollador ya conoce, un solo lenguaje, **costo cero en la capa gratuita** y poca configuración.

## Decisión

| Capa | Elección | Costo | Referencia |
|---|---|---|---|
| Lenguaje | TypeScript estricto | — | ADR-0003 |
| Monorepo | pnpm workspaces | — | ADR-0002 |
| Web app | React + Vite + React Router (SPA), PWA con `vite-plugin-pwa` | — | ADR-0003, ADR-0016 |
| Datos en el cliente | TanStack Query (solo en memoria) y TanStack Virtual | — | ADR-0024 |
| Cliente del catálogo | `fetch` + consultas GraphQL tipadas, validadas con Zod | — | ADR-0024 |
| Tarjeta para compartir | `html-to-image` + Web Share API, con descarga como alternativa | — | ADR-0003 |
| i18n | i18next + react-i18next (español e inglés) | — | ADR-0010 |
| Landing | Astro | — | ADR-0012 |
| API | Express + Node 22, Zod 4 + `zod-openapi` | — | ADR-0018, ADR-0023 |
| ORM | Prisma sobre el pooler de Supabase | — | ADR-0018, ADR-0022 |
| Base de datos | PostgreSQL (Supabase) | Gratis → US$25/mes | ADR-0022 |
| Autenticación | Supabase Auth (Google), JWT verificado con `jose` | Gratis | ADR-0025 |
| Catálogo | AniList GraphQL, desde el navegador | Gratis (licencia si hay ingresos sobre US$150/mes) | ADR-0024 |
| Pagos | Lemon Squeezy (*merchant of record*: gestiona impuestos) | Comisión por venta, sin costo fijo | ADR-0025 |
| Hosting | Vercel (web, API y landing) | Hobby gratis → Pro US$20/mes | ADR-0020 |
| Analítica de producto y banderas | PostHog Cloud | Gratis en la capa gratuita | ADR-0030 |
| Errores | Sentry | Gratis (plan Developer) | ADR-0030 |
| Logs | `pino` (JSON) → logs de Vercel | Gratis | ADR-0030 |
| Lint y formato | Biome | — | ADR-0003 |
| Pruebas | Vitest, Testing Library, Supertest, Playwright | — | ADR-0029 |
| CI/CD | GitHub Actions + integración de Vercel con Git | Gratis | ADR-0027 |
| Diseño | Figma (equipo Pro del stakeholder) | Ya pagado | — |
| Plataforma | **Solo web** (SPA responsive + PWA); sin apps nativas por ahora | — | ADR-0031 |

**Costo fijo mensual:** US$0 durante la validación y la beta; unos US$20 al empezar a cobrar Plus (Vercel Pro); unos US$45 con Supabase Pro, al superar unos 8.000 usuarios con datos (ADR-0021). A eso se suma la licencia comercial de AniList, de costo aún desconocido (R-02).

### Descartadas en esta revisión

| Tecnología | Motivo |
|---|---|
| Next.js | Se mantiene la decisión de ADR-0003. El único caso que lo justificaría (vista previa en redes del perfil público) se resuelve con una función de imagen Open Graph en la API. |
| Render | Reemplazado por Vercel (ADR-0020). |
| API de MyAnimeList como catálogo | Reemplazada por AniList (ADR-0024); queda como plan B. |
| Apps nativas (Kotlin, Swift) y pagos de las tiendas | Acrux es solo web por ahora (ADR-0031); se usa Lemon Squeezy. |

## Consecuencias

- **Positivas:** todo el stack en un solo lugar; costo cero hasta tener ingresos.
- **Negativas / riesgos:** varias piezas dependen de capas gratuitas que pueden cambiar sus condiciones; se revisan antes de cada hito.
- **Acciones derivadas:**
  - Agregar la generación de la imagen Open Graph del perfil público (`@vercel/og`) cuando se implemente RF-40.

