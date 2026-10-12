# ADR-0002: Estrategia de repositorio: monorepo

- **Estado:** Propuesto
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Inicio del proyecto. No se trató en las reuniones 001–005. Actualizado tras la sesión del 2026-10-12.

## Contexto

Acrux tendrá estas piezas:

- **Web app responsive mobile first** en React (ADR-0013, ADR-0003).
- **Backend en Supabase** (ADR-0006): migraciones SQL, políticas RLS y, si hace falta, Edge Functions.
- **Proxy de la API de MyAnimeList** (Edge Function), solo si el spike de CORS lo exige (ADR-0008).
- **Landing page en Astro, en Vercel**, con política de privacidad, soporte e información (ADR-0012).
- **Documentación**, incluidos estos ADRs.
- Más adelante, **apps nativas** de Android (Kotlin) e iOS (Swift), fuera del MVP (ADR-0013).

Las piezas comparten tipos (el modelo del catálogo y del usuario), textos de i18n en español e inglés (ADR-0010) y la marca. Hay que decidir si viven en un solo repositorio o en varios. El plazo de 18 días obliga a minimizar el tiempo de configuración.

## Opciones consideradas

### Opción A: Monorepo con pnpm workspaces

Un solo repositorio con `apps/` y `packages/`; pnpm workspaces para enlazar paquetes. Turborepo es opcional y se puede sumar después para tareas en paralelo y caché.

- **Ventajas:**
  - Cambios atómicos: una migración de Supabase, los tipos generados y el código de la web app que los usa van en el mismo commit.
  - Tipos de la base de datos (`supabase gen types`) y textos de i18n compartidos entre la web app y la landing.
  - Una sola configuración de TypeScript, lint, formato y CI.
  - Los ADRs viven junto al código.
- **Desventajas:**
  - Los despliegues de Vercel (web app y landing) deben configurarse para trabajar sobre un subdirectorio.
  - Las apps nativas futuras (Gradle, Xcode) no encajan en el toolchain de pnpm; se resuelve ubicándolas fuera del workspace.

### Opción B: Polirepo (web app, landing y backend por separado)

- **Ventajas:** cada repositorio usa su configuración por defecto; despliegues independientes.
- **Desventajas:** los tipos y textos compartidos se duplican o se publican como paquetes; los cambios transversales requieren varios PRs; más sobrecarga para una sola persona.

### Opción C: Repositorio único sin workspaces (la app en la raíz)

- **Ventajas:** cero configuración extra.
- **Desventajas:** la landing no tiene dónde vivir sin reorganizar después; mover todo a un monorepo más adelante cuesta más que hacerlo al inicio.

## Decisión

**Pendiente.** Propuesta: **Opción A, monorepo con pnpm workspaces**, sin Turborepo al inicio. Hay solo dos aplicaciones y el beneficio principal (tipos e i18n compartidos, cambios atómicos) no requiere orquestador.

El riesgo de integración es **bajo**: React (Vite) y Astro son estándar en pnpm workspaces y Vercel soporta monorepos con un directorio raíz por proyecto. Si en el Sprint 0 la configuración consume más de medio día, la salida es la Opción C para la web app y mover la landing a un repositorio aparte, registrado en un ADR que reemplace a este.

Las apps nativas futuras pueden vivir en el mismo repositorio (`apps/android`, `apps/ios`) **fuera del workspace de pnpm**, y compartirían solo el esquema de Supabase y, posiblemente, los textos de i18n como JSON (ADR-0003, ADR-0004).

## Consecuencias (si se acepta)

- **Positivas:** un solo lugar para web app, backend, landing y documentación; los tipos generados de Supabase se consumen en toda la parte TypeScript.
- **Negativas / riesgos:** bajo; tiempo de configuración de los dos proyectos de Vercel en el Sprint 0.
- **Acciones derivadas:**
  - Crear la estructura descrita en ADR-0004.
  - Fijar versiones de Node (LTS) y pnpm en el repositorio.
  - **Ramas:** desarrollo directo sobre `main` con ramas cortas (*trunk-based*), adecuado para un solo programador.
  - **Commits:** formato Conventional Commits.

## Preguntas abiertas

- ¿El repositorio será público como parte del portafolio? Si lo es, hay que cuidar que no se suban secretos (claves de Supabase, credenciales de OAuth).
- ¿Validar en el Sprint 0 que los dos proyectos de Vercel (web app y landing) despliegan correctamente desde el monorepo antes de seguir?
