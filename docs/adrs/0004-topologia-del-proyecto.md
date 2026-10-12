# ADR-0004: Topología del proyecto

- **Estado:** Propuesto
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Inicio del proyecto; se apoya en las decisiones de las reuniones 001–005 y en la sesión del 2026-10-12.

## Contexto

Hay que definir dos aspectos de la topología:

1. **Código:** cómo se organiza el monorepo (ADR-0002) y qué dependencias se permiten.
2. **Despliegue:** qué componentes se ejecutan, dónde y cómo se comunican.

Restricciones:

- El MVP es una web app responsive mobile first; las apps nativas llegan después (ADR-0013).
- El backend es Supabase (ADR-0006); no se planifica una API propia.
- El catálogo vive en el Postgres de Supabase, sembrado desde un dataset (ADR-0008).
- La app requiere conexión; no hay modo offline (D14, ADR-0013).
- La landing con la política de privacidad va en Vercel (ADR-0012).
- El borrado de cuenta dentro de la app es un requisito del MVP (ADR-0007, ADR-0014); Apple lo exige a las apps de su tienda y se aplica igual aquí como buena práctica y para el futuro. Requiere una operación con privilegios de administrador.

## Topología de código propuesta

```
acrux-anime/
├── apps/
│   ├── web/             # Web app React (responsive, mobile first)
│   ├── landing/         # Landing en Astro: privacidad, soporte, información
│   ├── android/         # Futuro: app Kotlin (fuera del workspace de pnpm)
│   └── ios/             # Futuro: app Swift (fuera del workspace de pnpm)
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

`apps/android` y `apps/ios` no existen en el MVP. Cuando se creen, vivirán fuera del toolchain de pnpm (Gradle y Xcode) y compartirán con el resto solo el esquema de Supabase y, posiblemente, los textos de `packages/i18n` exportados como JSON.

Reglas de dependencia:

- `apps/*` pueden depender de `packages/*`; una app **nunca** depende de otra app.
- `packages/shared` no depende de React ni de ningún framework.
- `scripts/seed-catalog` puede usar `packages/shared`, pero ninguna app depende de los scripts.
- Las claves con privilegios (`service_role` de Supabase) solo se usan en `scripts/` y en `supabase/functions/`; **nunca** en `apps/web` ni en `apps/landing`, cuyo código llega al navegador.

## Topología de despliegue: opciones consideradas

### Opción A: Web app → Supabase directo (BaaS), con Edge Functions puntuales

La web app usa el SDK de Supabase en el navegador para autenticarse y consultar Postgres (vía la API REST que Supabase genera). La seguridad se resuelve con políticas RLS: cada usuario solo lee y escribe sus propias marcas. Las operaciones privilegiadas, como el borrado de cuenta, van en Edge Functions.

- **Ventajas:** sin servidor propio que mantener; mínimo código de backend; encaja con el plazo.
- **Desventajas:** la lógica de negocio queda repartida entre la app y las políticas SQL; acoplamiento al modelo de Supabase.

### Opción B: Web app → API propia → Supabase/Postgres

- **Ventajas:** control total de la lógica y la validación.
- **Desventajas:** otro componente que desarrollar, desplegar y operar; contradice el objetivo de D8.

### Diagrama de la Opción A

```
 [Navegador] ──► apps/web (Vercel, archivos estáticos)
      │
      ├──► Supabase Auth ◄── Google / Apple (OAuth con redirección)
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
                  └─ URL pública de la política de privacidad (también requerida por la pantalla de consentimiento de Google OAuth)
```

### Contador total

El contador total (ADR-0009) puede calcularse con un `count` sobre las marcas del usuario o mantenerse en una columna actualizada por un trigger. Para el MVP basta con el `count` y una actualización optimista en la app; se revisa si aparece algún problema de rendimiento.

## Decisión

**Pendiente.** Propuesta:

- **Código:** la estructura anterior, con sus reglas de dependencia.
- **Despliegue:** **Opción A**, la web app habla directo con Supabase, con RLS en todas las tablas de usuario y Edge Functions solo para operaciones privilegiadas.

## Consecuencias (si se acepta)

- **Positivas:** la topología más simple posible para cumplir el hito; las apps nativas futuras reutilizan el mismo Supabase y su esquema.
- **Negativas / riesgos:** una política RLS mal escrita expone datos de otros usuarios; hay que probarlas. Al ejecutarse en el navegador, cualquier clave incluida en la web app es pública: solo se usa la clave anónima.
- **Acciones derivadas:**
  - Diseñar el esquema (catálogo, géneros, perfiles, marcas) con RLS activada desde la primera migración.
  - Implementar la Edge Function de borrado de cuenta antes del hito del 28-oct (ADR-0014).
  - Definir entornos: propuesta inicial de un proyecto Supabase de desarrollo y uno de producción.

## Preguntas abiertas

- Estrategia de imágenes del catálogo (ADR-0008).
- ¿Un solo proyecto de Supabase en el MVP o dos (desarrollo y producción)? La capa gratuita limita la cantidad de proyectos activos.
- ¿Desarrollo local con la CLI de Supabase (Docker) o directo contra el proyecto de desarrollo?
