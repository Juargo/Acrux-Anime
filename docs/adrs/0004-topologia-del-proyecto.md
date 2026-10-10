# ADR-0004: Topología del proyecto

- **Estado:** Propuesto
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Inicio del proyecto; se apoya en las decisiones de las reuniones 001–005.

## Contexto

Hay que definir dos aspectos de la topología:

1. **Código:** cómo se organiza el monorepo (ADR-0002) y qué dependencias se permiten.
2. **Despliegue:** qué componentes se ejecutan, dónde y cómo se comunican.

Restricciones de las reuniones:

- Solo hay app móvil en el MVP; la web llega después (ADR-0005).
- El backend es Supabase (ADR-0006); no se planifica una API propia.
- El catálogo vive en el Postgres de Supabase, sembrado desde un dataset (ADR-0008).
- La app requiere conexión; no hay modo offline (D14).
- La landing con la política de privacidad va en Vercel (ADR-0012).
- Apple exige que el usuario pueda borrar su cuenta dentro de la app (Reunión 004), lo que requiere una operación con privilegios de administrador.

## Topología de código propuesta

```
acrux-anime/
├── apps/
│   ├── mobile/          # App Expo (Android e iOS)
│   └── landing/         # Landing en Vercel: privacidad, soporte, información
├── packages/
│   ├── shared/          # Tipos del dominio y tipos generados de Supabase
│   └── i18n/            # Textos en español e inglés compartidos
├── supabase/
│   ├── migrations/      # Esquema SQL y políticas RLS
│   └── functions/       # Edge Functions (por ejemplo, borrado de cuenta)
├── scripts/
│   └── seed-catalog/    # Siembra del catálogo y mapeo de géneros
├── docs/
│   └── adrs/            # Registro de decisiones
└── .github/workflows/   # CI
```

Reglas de dependencia:

- `apps/*` pueden depender de `packages/*`; una app **nunca** depende de otra app.
- `packages/shared` no depende de React, Expo ni de ningún framework.
- `scripts/seed-catalog` puede usar `packages/shared`, pero ninguna app depende de los scripts.
- Las claves con privilegios (`service_role` de Supabase) solo se usan en `scripts/` y en `supabase/functions/`; **nunca** en `apps/mobile`.

## Topología de despliegue: opciones consideradas

### Opción A: App → Supabase directo (BaaS), con Edge Functions puntuales

La app usa el SDK de Supabase para autenticarse y consultar Postgres (vía la API REST que Supabase genera). La seguridad se resuelve con políticas RLS: cada usuario solo lee y escribe sus propias marcas. Las operaciones privilegiadas, como el borrado de cuenta, van en Edge Functions.

- **Ventajas:** sin servidor propio que mantener; mínimo código de backend; encaja con el plazo.
- **Desventajas:** la lógica de negocio queda repartida entre la app y las políticas SQL; acoplamiento al modelo de Supabase.

### Opción B: App → API propia → Supabase/Postgres

- **Ventajas:** control total de la lógica y la validación.
- **Desventajas:** otro componente que desarrollar, desplegar y operar; contradice el objetivo de D8.

### Diagrama de la Opción A

```
 [App móvil Expo] ──► Supabase Auth ◄── Google / Apple (OAuth)
        │
        ├──► Supabase Postgres (API REST + RLS)
        │       ├─ catálogo (solo lectura, sembrado una vez)
        │       └─ marcas de «visto» por usuario
        │
        ├──► Edge Function: borrado de cuenta
        │
        └──► Portadas (URLs de terceros o storage propio: pendiente, ADR-0008)

 [scripts/seed-catalog] ──► Supabase Postgres (service_role, ejecución puntual)

 [Navegador] ──► apps/landing (Vercel): privacidad, soporte, información
                  └─ URL pública para las fichas de App Store y Google Play
```

### Contador total

El contador total (ADR-0009) puede calcularse con un `count` sobre las marcas del usuario o mantenerse en una columna actualizada por un trigger. Para el MVP basta con el `count` y una actualización optimista en la app; se revisa si aparece algún problema de rendimiento.

## Decisión

**Pendiente.** Propuesta:

- **Código:** la estructura anterior, con sus reglas de dependencia.
- **Despliegue:** **Opción A**, la app habla directo con Supabase, con RLS en todas las tablas de usuario y Edge Functions solo para operaciones privilegiadas.

## Consecuencias (si se acepta)

- **Positivas:** la topología más simple posible para cumplir el hito; la web futura (E6) puede reutilizar el mismo Supabase y `packages/shared`.
- **Negativas / riesgos:** una política RLS mal escrita expone datos de otros usuarios; hay que probarlas.
- **Acciones derivadas:**
  - Diseñar el esquema (catálogo, géneros, perfiles, marcas) con RLS activada desde la primera migración.
  - Implementar la Edge Function de borrado de cuenta antes del envío a App Store.
  - Definir entornos: propuesta inicial de un proyecto Supabase de desarrollo y uno de producción.

## Preguntas abiertas

- Estrategia de imágenes del catálogo (ADR-0008).
- ¿Un solo proyecto de Supabase en el MVP o dos (desarrollo y producción)? La capa gratuita limita la cantidad de proyectos activos.
- ¿Desarrollo local con la CLI de Supabase (Docker) o directo contra el proyecto de desarrollo?
