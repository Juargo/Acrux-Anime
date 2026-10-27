# ADR-0002: Estrategia de repositorio: monorepo

- **Estado:** Aceptado
- **Fecha:** 2026-10-12 (aceptado el 2026-10-27)
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Inicio del proyecto. Actualizado tras las sesiones del 2026-10-12 y del 2026-10-27 (solo web, API en Vercel, catálogo de AniList).

## Contexto

Acrux tiene estas piezas, todas en TypeScript:

- **Web app** responsive mobile first en React + Vite, instalable como PWA (ADR-0013, ADR-0016, ADR-0026).
- **API propia** en Express, desplegada como función de Vercel en el mismo proyecto que la web app (ADR-0018, ADR-0020), con el esquema y las migraciones de Prisma (ADR-0022).
- **Landing** en Astro, en Vercel (ADR-0012).
- **Dominio puro** (agrupamiento de franquicias, contador, plan) y **contratos** (esquemas Zod) compartidos entre la web y la API (ADR-0019, ADR-0023).
- **Textos de i18n** en español e inglés, compartidos entre la web app y la landing (ADR-0010).
- **Documentación**, incluidos estos ADRs y los criterios de aceptación (ADR-0029).

Acrux es **solo web** (ADR-0031): no hay apps nativas que acomodar. Hay que decidir si estas piezas viven en un solo repositorio o en varios.

## Opciones consideradas

### Opción A: Monorepo con pnpm workspaces

Un solo repositorio con `apps/` y `packages/`; pnpm workspaces para enlazar paquetes. Turborepo es opcional y se puede sumar después para tareas en paralelo y caché.

- **Ventajas:**
  - Cambios atómicos: una migración de Prisma, el contrato de la API y el código de la web app que lo usa van en el mismo commit y en el mismo despliegue (ADR-0020).
  - Dominio, contratos e i18n compartidos sin publicar paquetes.
  - Una sola configuración de TypeScript, Biome y CI (ADR-0027).
  - Los ADRs viven junto al código.
- **Desventajas:** los proyectos de Vercel (`app` y `landing`) deben configurarse con su directorio raíz dentro del monorepo.

### Opción B: Polirepo (web app, API y landing por separado)

- **Ventajas:** cada repositorio usa su configuración por defecto.
- **Desventajas:** los tipos, contratos y textos compartidos se duplican o se publican como paquetes; los cambios transversales requieren varios PRs; más sobrecarga para una sola persona.

### Opción C: Repositorio único sin workspaces (la app en la raíz)

- **Ventajas:** cero configuración extra.
- **Desventajas:** la landing y los paquetes compartidos no tienen dónde vivir sin reorganizar después.

## Decisión

**Opción A: monorepo con pnpm workspaces**, sin Turborepo al inicio.

### Estructura

```
acrux-anime/
├── apps/
│   ├── web/             # SPA React + Vite (PWA) — proyecto Vercel «app»
│   ├── api/             # API Express (ADR-0018), servida en /api del proyecto «app»
│   │   └── prisma/      # Esquema y migraciones (ADR-0022)
│   └── landing/         # Astro — proyecto Vercel «landing»
├── packages/
│   ├── domain/          # Reglas puras: franquicias, contador, plan (sin I/O)
│   ├── shared/          # Esquemas Zod y tipos de los contratos
│   └── i18n/            # Textos en español e inglés
├── docs/
│   ├── adrs/            # Registro de decisiones
│   └── criterios/       # Criterios de aceptación en Gherkin (ADR-0029)
├── odd/tasks/           # Notas de trabajo por funcionalidad
└── .github/workflows/   # CI/CD (ADR-0027)
```

### Reglas de dependencia

- `apps/*` pueden depender de `packages/*`; una app **nunca** depende de otra app.
- `packages/domain` no depende de ningún otro paquete ni de un framework.
- `packages/shared` depende solo de Zod y de `packages/domain`.
- Las reglas de capas dentro de `apps/api` están en ADR-0019 y se verifican en CI con `dependency-cruiser`.
- Ningún secreto vive en el repositorio, que es **público** (ADR-0027, ADR-0028).

### Flujo de trabajo

Trunk-based development con ramas cortas y PRs hacia `main`, y Conventional Commits (detalle en ADR-0027).

## Consecuencias

- **Positivas:** un solo lugar para web app, API, landing y documentación; cada despliegue publica juntas la web y la API que le corresponde.
- **Negativas / riesgos:** bajos; configurar los dos proyectos de Vercel con su directorio raíz. Si en el primer sprint esa configuración consume más de medio día, se registra un ADR nuevo que reemplace a este.
- **Acciones derivadas:**
  - Crear la estructura anterior y fijar las versiones de Node (22, en `.node-version`) y pnpm.
  - En el primer sprint, verificar que los proyectos `app` (web + API) y `landing` despliegan desde el monorepo antes de seguir.
