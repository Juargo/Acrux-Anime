# ADR-0012: Landing page en Vercel para privacidad, soporte e información

- **Estado:** Aceptado
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 004 (pendiente 4), Reunión 005 (D18)

## Contexto

App Store y Google Play exigen una **URL pública de política de privacidad** y una forma de contactar soporte. Google Play pide además una URL donde solicitar el borrado de cuenta. Estas URLs deben existir antes de abrir la prueba cerrada de Android (ADR-0011).

## Opciones consideradas

| Opción | Comentario |
|---|---|
| Documento en Google Docs o Notion publicado | Rápido, pero poco profesional para un portafolio. |
| Página de GitHub Pages | Gratuita, pero separada del flujo de despliegue del resto. |
| **Landing propia en Vercel** | Sirve también como página del producto en el portafolio; despliegue automático desde el monorepo. |

## Decisión

La política de privacidad, el soporte y la información de la app se alojan en una **landing page en Vercel** (D18). Esa landing es la URL pública que se usa en las fichas de ambas tiendas.

## Consecuencias

- **Positivas:** un solo lugar para los textos legales y la presentación del producto; reutiliza los textos de `packages/i18n` (ADR-0010).
- **Negativas / riesgos:** otra pieza que construir en el Sprint 0, que ya está cargado.
- **Acciones derivadas:**
  - Páginas mínimas: inicio, política de privacidad, soporte y borrado de cuenta, en español e inglés.
  - Atribución de la fuente del catálogo (ADR-0008).
  - Ubicación en el monorepo: `apps/landing` (ADR-0004). Framework: ver ADR-0003.

## Preguntas abiertas

- Dominio: ¿subdominio gratuito de Vercel o dominio propio?
- Textos de la landing y de la política de privacidad (Reunión 006).
