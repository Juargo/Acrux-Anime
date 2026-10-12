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
| [0002](./0002-estrategia-de-repositorio-monorepo.md) | Estrategia de repositorio: monorepo | Propuesto | Inicio del proyecto |
| [0003](./0003-stack-tecnologico.md) | Stack tecnológico | Propuesto | Reuniones 001, 002, 005 |
| [0004](./0004-topologia-del-proyecto.md) | Topología del proyecto | Propuesto | Inicio del proyecto |
| [0005](./0005-plataforma-mobile-primero.md) | Plataforma prioritaria: mobile primero, sin modo offline | Reemplazado por ADR-0013 | Reuniones 001, 003 |
| [0006](./0006-backend-supabase.md) | Backend: Supabase | Aceptado (catálogo propio reemplazado por ADR-0008) | Reunión 002 |
| [0007](./0007-autenticacion-google-y-apple.md) | Autenticación con Google y Apple, y borrado de cuenta | Aceptado (proveedores del MVP web reemplazados por ADR-0015) | Reuniones 001, 002, 004 |
| [0008](./0008-fuente-del-catalogo.md) | Fuente del catálogo: API oficial de MyAnimeList en vivo | Aceptado | Reuniones 001–005, Sesión 2026-10-12 |
| [0009](./0009-alcance-funcional-del-mvp.md) | Alcance funcional del MVP | Aceptado (ítem «versión web fuera del MVP» reemplazado por ADR-0013; filtros sujetos a la validación de la API de MAL, ADR-0008) | Reuniones 001–003 |
| [0010](./0010-internacionalizacion.md) | Internacionalización en español e inglés desde el inicio | Aceptado | Reunión 003 |
| [0011](./0011-hitos-y-estrategia-de-tiendas.md) | Hitos de publicación y estrategia de tiendas | Reemplazado por ADR-0014 | Reuniones 001–004 |
| [0012](./0012-landing-page-en-vercel.md) | Landing page en Vercel para privacidad, soporte e información | Aceptado | Reuniones 004, 005 |
| [0013](./0013-plataforma-web-responsive-primero.md) | Plataforma prioritaria: web responsive mobile first, sin modo offline | Aceptado | Sesión 2026-10-12 |
| [0014](./0014-hito-web-en-produccion.md) | Hito del 28-oct: web app en producción | Aceptado | Sesión 2026-10-12 |
| [0015](./0015-login-solo-con-google-en-el-mvp-web.md) | Login solo con Google en el MVP web | Aceptado | Sesión 2026-10-12 |
| [0016](./0016-web-app-instalable-como-pwa.md) | Web app instalable como PWA, sin modo offline | Aceptado | Sesión 2026-10-12 |

## Trazabilidad con las reuniones

Las reuniones de análisis de requisitos se registran en Obsidian (`Acrux/01 Análisis de Requisitos/Reuniones`). Los identificadores de decisiones (`Dn`), supuestos (`Sn`) y riesgos (`Rn`) citados en los ADRs corresponden a esas notas.

| Decisión de reunión | ADR |
|---|---|
| D1, D2, D14 | 0005 (reemplazado por 0013: D2 cambia a web primero; D1 y D14 siguen vigentes) |
| D3, D7 | 0007 (D7 reemplazado por 0015 en el MVP web: solo Google) |
| D4, D6, D11, D12, D19 | 0009 |
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
| D13 | 0010 |
| D18 | 0012 |
