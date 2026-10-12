# ADR-0006: Backend: Supabase

- **Estado:** Aceptado (el catálogo propio en Postgres quedó reemplazado por el catálogo en vivo de ADR-0008; la Edge Function de borrado de cuenta, reemplazada por la API propia de ADR-0018; Supabase sigue como proveedor de auth y Postgres)
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (pendiente 9), Reunión 002 (D8)

## Contexto

La app requiere cuentas de usuario y guardar la lista de cada persona (D3), y un catálogo de unos 40.000 animes consultable con búsqueda y filtros (ADR-0009). El plazo de 18 días obliga a minimizar el código de backend.

## Opciones consideradas

### Opción A: Supabase

Autenticación, Postgres gestionado con API REST generada, políticas RLS, Edge Functions y storage.

- **Ventajas:** autenticación con Google y Apple incluida; Postgres permite filtros y búsqueda de texto eficientes sobre un catálogo propio; capa gratuita; SDK para React Native.
- **Desventajas:** dependencia del proveedor; la lógica de seguridad se escribe como políticas SQL.

### Opción B: Node + Prisma + PostgreSQL

- **Ventajas:** control total.
- **Desventajas:** hay que construir autenticación, API, despliegue y operación: inviable en el plazo.

## Decisión

**Supabase** (D8): Auth, Postgres y, cuando haga falta, Edge Functions.

## Consecuencias

- **Positivas:** el catálogo vive en nuestro Postgres, así que los filtros por año, género y tipo son rápidos y no dependen de límites de una API externa (Reunión 002, implicaciones).
- **Negativas / riesgos:** límites de la capa gratuita (tamaño de la base, proyectos inactivos que se pausan); hay que revisarlos antes del lanzamiento.
- **Acciones derivadas:**
  - Crear el proyecto y configurar OAuth de Google y Apple (Sprint 0).
  - RLS activada en todas las tablas con datos de usuario.
  - Edge Function para el borrado de cuenta (ADR-0007).
  - Topología de despliegue: ver ADR-0004.
