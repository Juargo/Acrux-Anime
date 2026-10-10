# ADR-0002: Estrategia de repositorio: monorepo

- **Estado:** Propuesto
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Inicio del proyecto. No se trató en las reuniones 001–005.

## Contexto

Según lo decidido en las reuniones, Acrux tendrá estas piezas:

- **App móvil** para Android e iOS (ADR-0005), probablemente con Expo (ADR-0003).
- **Backend en Supabase** (ADR-0006): migraciones SQL, políticas RLS y, si hace falta, Edge Functions.
- **Script de siembra del catálogo** (ADR-0008), que se ejecuta una vez o de forma puntual.
- **Landing page en Vercel** con política de privacidad, soporte e información de la app (ADR-0012).
- **Documentación**, incluidos estos ADRs.
- Más adelante, una **versión web** (épica E6).

Las piezas comparten tipos (el modelo del catálogo y del usuario), textos de i18n en español e inglés (ADR-0010) y la marca. Hay que decidir si viven en un solo repositorio o en varios. El plazo de 18 días obliga a minimizar el tiempo de configuración.

## Opciones consideradas

### Opción A: Monorepo con pnpm workspaces

Un solo repositorio con `apps/` y `packages/`; pnpm workspaces para enlazar paquetes. Turborepo es opcional y se puede sumar después para tareas en paralelo y caché.

- **Ventajas:**
  - Cambios atómicos: una migración de Supabase, los tipos generados y el código de la app que los usa van en el mismo commit.
  - Tipos de la base de datos (`supabase gen types`) y textos de i18n compartidos entre la app, la landing y la futura web.
  - Una sola configuración de TypeScript, lint, formato y CI.
  - Los ADRs viven junto al código.
- **Desventajas:**
  - Expo y Metro necesitan configuración específica para monorepos (resolución de módulos, enlaces simbólicos de pnpm). Las versiones recientes de Expo lo soportan, pero hay que validarlo en el Sprint 0; la salida conocida es `node-linker=hoisted` en `.npmrc`.
  - Los despliegues (EAS para la app, Vercel para la landing) deben configurarse para trabajar sobre un subdirectorio.

### Opción B: Polirepo (app, landing y backend por separado)

- **Ventajas:** cada repositorio usa su configuración por defecto (sin ajustes de Metro ni de Vercel); despliegues independientes.
- **Desventajas:** los tipos y textos compartidos se duplican o se publican como paquetes; los cambios transversales requieren varios PRs; más sobrecarga para una sola persona.

### Opción C: Repositorio único sin workspaces (la app en la raíz)

- **Ventajas:** cero configuración extra; Expo funciona tal cual.
- **Desventajas:** la landing y la futura web no tienen dónde vivir sin reorganizar después; mover todo a un monorepo más adelante cuesta más que hacerlo al inicio.

## Decisión

**Pendiente.** Propuesta: **Opción A, monorepo con pnpm workspaces**, sin Turborepo al inicio. Hay solo dos aplicaciones y el beneficio principal (tipos e i18n compartidos, cambios atómicos) no requiere orquestador.

Si en el Sprint 0 la integración de Expo con el monorepo consume más de medio día, la salida es la Opción C para la app y mover la landing a un repositorio aparte. Ese caso se registraría en un ADR que reemplace a este.

## Consecuencias (si se acepta)

- **Positivas:** un solo lugar para app, backend, landing y documentación; los tipos generados de Supabase se consumen en todas las apps.
- **Negativas / riesgos:** tiempo de configuración de Metro/EAS en el Sprint 0, la etapa con más presión.
- **Acciones derivadas:**
  - Crear la estructura descrita en ADR-0004.
  - Fijar versiones de Node (LTS) y pnpm en el repositorio.
  - **Ramas:** desarrollo directo sobre `main` con ramas cortas (*trunk-based*), adecuado para un solo programador.
  - **Commits:** formato Conventional Commits.

## Preguntas abiertas

- ¿El repositorio será público como parte del portafolio? Si lo es, hay que cuidar que no se suban secretos (claves de Supabase, credenciales de OAuth, certificados de firma).
- ¿Validar en el Sprint 0 que Expo, pnpm y EAS Build funcionan en el monorepo antes de seguir?
