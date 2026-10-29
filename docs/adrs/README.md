# Architecture Decision Records (ADRs)

Cada ADR registra **una** decisión relevante del proyecto: el contexto que la motiva, las opciones evaluadas, la decisión tomada y sus consecuencias.

## Convenciones

- **Nombre de archivo:** `NNNN-titulo-en-kebab-case.md` (numeración correlativa, nunca se reutiliza un número).
- **Plantilla:** [`0000-plantilla.md`](./0000-plantilla.md).
- **Estados:**
  - `Propuesto`: en discusión, todavía no hay decisión.
  - `Aceptado`: decisión vigente.
  - `Rechazado`: se evaluó y se descartó.
  - `Reemplazado por ADR-NNNN`: la decisión dejó de estar vigente.
- Un ADR `Aceptado` no se reescribe. Si la decisión cambia, se crea un ADR nuevo que lo reemplaza y se actualiza el estado del anterior.
- Las secciones *Preguntas abiertas* de los ADRs `Propuesto` deben quedar resueltas antes de pasar a `Aceptado`.

## Índice

| # | Título | Estado | Origen |
|---|---|---|---|
| [0001](./0001-metodologia-ciclo-de-vida.md) | Metodología de ciclo de vida del desarrollo | Aceptado (plan de sprints reemplazado por ADR-0014) | Reuniones 001, 002 |
| [0002](./0002-estrategia-de-repositorio-monorepo.md) | Estrategia de repositorio: monorepo | Aceptado | Inicio del proyecto |
| [0003](./0003-stack-tecnologico.md) | Stack tecnológico | Reemplazado por ADR-0026 | Reuniones 001, 002, 005 |
| [0004](./0004-topologia-del-proyecto.md) | Topología del proyecto | Reemplazado por ADR-0019 (código) y ADR-0020 (despliegue) | Inicio del proyecto |
| [0005](./0005-plataforma-mobile-primero.md) | Plataforma prioritaria: mobile primero, sin modo offline | Reemplazado por ADR-0013 | Reuniones 001, 003 |
| [0006](./0006-backend-supabase.md) | Backend: Supabase | Reemplazado por ADR-0034 | Reunión 002 |
| [0007](./0007-autenticacion-google-y-apple.md) | Autenticación con Google y Apple, y borrado de cuenta | Aceptado (proveedores del MVP web reemplazados por ADR-0015; borrado de cuenta como Edge Function reemplazado por ADR-0018) | Reuniones 001, 002, 004 |
| [0008](./0008-fuente-del-catalogo.md) | Fuente del catálogo: API oficial de MyAnimeList en vivo | Reemplazado por ADR-0024 | Reuniones 001–005, Sesión 2026-10-12 |
| [0009](./0009-alcance-funcional-del-mvp.md) | Alcance funcional del MVP | Aceptado (ítem «versión web fuera del MVP» reemplazado por ADR-0013; ítems 1–3 reemplazados por ADR-0017) | Reuniones 001–003 |
| [0010](./0010-internacionalizacion.md) | Internacionalización en español e inglés desde el inicio | Aceptado | Reunión 003 |
| [0011](./0011-hitos-y-estrategia-de-tiendas.md) | Hitos de publicación y estrategia de tiendas | Reemplazado por ADR-0014 | Reuniones 001–004 |
| [0012](./0012-landing-page-en-vercel.md) | Landing page en Vercel para privacidad, soporte e información | Aceptado | Reuniones 004, 005 |
| [0013](./0013-plataforma-web-responsive-primero.md) | Plataforma prioritaria: web responsive mobile first, sin modo offline | Aceptado (fase nativa reemplazada por ADR-0031) | Sesión 2026-10-12 |
| [0014](./0014-hito-web-en-produccion.md) | Hito del 28-oct: web app en producción | Reemplazado por ADR-0031 | Sesión 2026-10-12 |
| [0015](./0015-login-solo-con-google-en-el-mvp-web.md) | Login solo con Google en el MVP web | Aceptado | Sesión 2026-10-12 |
| [0016](./0016-web-app-instalable-como-pwa.md) | Web app instalable como PWA, sin modo offline | Aceptado | Sesión 2026-10-12 |
| [0017](./0017-exploracion-del-catalogo-por-nombre-o-anio.md) | Exploración del catálogo: por nombre o por año, con filtros de género y tipo | Aceptado (operaciones de catálogo al navegador, ADR-0024) | Sesión 2026-10-12 |
| [0018](./0018-api-propia-con-express-y-typescript.md) | API propia con Express y TypeScript como intermediaria con MyAnimeList | Aceptado (MAL reemplazado por ADR-0024; Render por ADR-0020) | Sesión 2026-10-12 |
| [0019](./0019-estilo-de-arquitectura-monolito-modular-por-capas.md) | Estilo de arquitectura: monolito modular por capas | Aceptado | Sesión 2026-10-27 |
| [0020](./0020-topologia-de-despliegue-vercel-y-supabase.md) | Topología de despliegue: Vercel (web, API y landing) y Supabase | Aceptado (Supabase reemplazado por Neon en ADR-0034) | Sesión 2026-10-27 |
| [0021](./0021-mantenibilidad-y-escalabilidad.md) | Mantenibilidad y escalabilidad | Aceptado | Sesión 2026-10-27 |
| [0022](./0022-base-de-datos-postgresql-relacional-acid.md) | Base de datos: PostgreSQL relacional (ACID) en Supabase, con Prisma | Aceptado (retención de respaldos reemplazada por ADR-0032; Supabase reemplazado por Neon en ADR-0034) | Sesión 2026-10-27 |
| [0023](./0023-estilo-de-api-rest-con-openapi.md) | Estilo de la API: REST con contrato OpenAPI, sin WebSocket | Aceptado | Sesión 2026-10-27 |
| [0024](./0024-catalogo-anilist-desde-el-navegador.md) | Fuente del catálogo: AniList, consultada desde el navegador | Aceptado | Reunión 006, decisiones 2026-10-26, sesión 2026-10-27 |
| [0025](./0025-autenticacion-y-autorizacion.md) | Autenticación y autorización | Aceptado (Supabase Auth reemplazado por Neon Auth en ADR-0034) | Sesión 2026-10-27 |
| [0026](./0026-stack-tecnologico-consolidado.md) | Stack tecnológico consolidado | Aceptado (base de datos, ORM y autenticación reemplazados por ADR-0034) | Sesión 2026-10-27 |
| [0027](./0027-ci-cd.md) | CI/CD: GitHub Actions y despliegue en Vercel | Aceptado | Sesión 2026-10-27 |
| [0028](./0028-seguridad-y-privacidad-by-design-y-by-default.md) | Seguridad y privacidad desde el diseño y por defecto | Aceptado (retención de respaldos reemplazada por ADR-0032) | Sesión 2026-10-27 |
| [0029](./0029-estrategia-de-pruebas-y-criterios-de-aceptacion.md) | Estrategia de pruebas (pirámide) y criterios de aceptación en Gherkin | Aceptado | Sesión 2026-10-27 |
| [0030](./0030-observabilidad-kpis-logs-y-errores.md) | Observabilidad: KPIs, logs y errores | Aceptado | Sesión 2026-10-27 |
| [0031](./0031-validar-primero-sin-fecha-fija-y-solo-web.md) | Validar primero, sin fecha fija, y solo web | Aceptado | Decisión 2026-10-26, sesión 2026-10-27 |
| [0032](./0032-retencion-de-respaldos-de-30-dias.md) | Retención de los respaldos: 30 días | Aceptado | Sesión 2026-10-27 |
| [0033](./0033-lista-de-espera-con-buttondown.md) | Lista de espera con Buttondown | Aceptado | Sesión 2026-10-27 |
| [0034](./0034-neon-para-postgres-y-autenticacion.md) | Neon para Postgres y autenticación, en lugar de Supabase | Aceptado | Sesión 2026-10-28 |

## Trazabilidad con las reuniones

Las reuniones de análisis de requisitos se registran en Obsidian (`Acrux/01 Análisis de Requisitos/Reuniones`). Los identificadores de decisiones (`Dn`), supuestos (`Sn`) y riesgos (`Rn`) citados en los ADRs corresponden a esas notas.

| Decisión de reunión | ADR |
|---|---|
| D1, D2, D14 | 0005 (reemplazado por 0013: D2 cambia a web primero; D1 y D14 siguen vigentes) |
| D3, D7 | 0007 (D7 reemplazado por 0015 en el MVP web: solo Google) |
| D4, D6, D11, D12, D19 | 0009 (D11 reemplazado por 0017: exploración por nombre o por año, con filtros de género y tipo) |
| D5, D15, D16, D17 | 0011 (reemplazado por 0014: el hito pasa a web en producción; sin prueba cerrada ni revisión de tiendas) |
| Sesión 2026-10-12: MVP como web app responsive mobile first; apps nativas en el futuro | 0013 |
| Sesión 2026-10-12: hito del 28-oct con web en producción en Vercel | 0014 |
| Sesión 2026-10-12: React (Vite + React Router, SPA) para la web app, Astro para la landing, Biome para lint y formato y Playwright para pruebas E2E de humo | 0003 |
| Sesión 2026-10-12: dominio `acruxanime.com` (landing) y `app.acruxanime.com` (web app) | 0004 |
| Sesión 2026-10-12: login solo con Google en el MVP web; Apple con la app iOS | 0015 |
| Sesión 2026-10-12: web app instalable como PWA, sin modo offline | 0016 |
| D8 | 0006 |
| D9 | 0001 |
| D10 (descartada el 2026-10-12: catálogo en vivo desde la API oficial de MAL) | 0008 |
| Sesión 2026-10-12: catálogo en vivo desde la API oficial de MyAnimeList v2; solo se guarda el id del anime visto | 0008 |
| Sesión 2026-10-12: exploración del catálogo por nombre o por año, con filtros de género y tipo en el cliente | 0017 |
| Sesión 2026-10-12: API propia en Express y TypeScript (stack de referencia sin Clean Architecture) como intermediaria con MAL y gestora de cuentas | 0018 |
| Decisión 2026-10-26: mantener AniList como fuente del catálogo (MAL como plan B) | 0024 (reemplaza 0008) |
| Sesión 2026-10-27: monolito modular por capas; sin microservicios ni broker | 0019 |
| Sesión 2026-10-27: todo en Vercel (Hobby → Pro antes de cobrar) + Supabase; API en el mismo origen | 0020 |
| Sesión 2026-10-27: PostgreSQL ACID con Prisma; RLS sin políticas como defensa en profundidad | 0022 |
| Sesión 2026-10-27: catálogo consultado desde el navegador | 0024 |
| Sesión 2026-10-27: Supabase Auth (Google) + autorización denegada por defecto en la API | 0025 |
| Sesión 2026-10-27: alcance de privacidad: ley chilena + GDPR básico | 0028 |
| Sesión 2026-10-27: criterios de aceptación en Gherkin | 0029 |
| Sesión 2026-10-27: PostHog + Sentry para KPIs y errores | 0030 |
| Decisión 2026-10-26: sin fecha fija, primero validar; sesión 2026-10-27: solo web, sin apps nativas | 0031 (reemplaza 0014 y la fase nativa de 0013) |
| Sesión 2026-10-27: respaldos con retención de 30 días (DD-32) | 0032 (reemplaza la retención de 0022 y 0028) |
| Sesión 2026-10-27: lista de espera de la landing en Buttondown, con doble confirmación | 0033 (complementa 0028) |
| Sesión 2026-10-27: repo público, región São Paulo, lista privada por defecto | 0027, 0020, 0028 |
| Sesión 2026-10-27: monorepo con pnpm workspaces aceptado (solo web) | 0002 |
| D13 | 0010 |
| D18 | 0012 |
