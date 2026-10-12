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
- Hay una **API propia** en Express y TypeScript (ADR-0018) entre la web app y MyAnimeList/Postgres. Supabase aporta la autenticación (Google) y el Postgres (ADR-0006).
- No se almacena un catálogo: se consulta en vivo la API oficial de MyAnimeList v2 (ADR-0008). Postgres guarda solo perfiles y marcas de «visto» (ids de MAL).
- La app requiere conexión; no hay modo offline (D14, ADR-0013).
- La landing con la política de privacidad va en Vercel (ADR-0012).
- El borrado de cuenta dentro de la app es un requisito del MVP (ADR-0007, ADR-0014); Apple lo exige a las apps de su tienda y se aplica igual aquí como buena práctica y para el futuro. Requiere una operación con privilegios de administrador, que ejecuta la API (ADR-0018).

## Topología de código propuesta

```
acrux-anime/
├── apps/
│   ├── web/             # Web app React (responsive, mobile first)
│   ├── landing/         # Landing en Astro: privacidad, soporte, información
│   ├── api/             # API Express + TypeScript (ADR-0018), desplegada en Render
│   │   └── prisma/      # Esquema y migraciones del esquema `public` (ADR-0018)
│   ├── android/         # Futuro: app Kotlin (fuera del workspace de pnpm)
│   └── ios/             # Futuro: app Swift (fuera del workspace de pnpm)
├── packages/
│   ├── shared/          # Tipos del dominio y contratos compartidos con la API
│   └── i18n/            # Textos en español e inglés compartidos
├── docs/
│   └── adrs/            # Registro de decisiones
└── .github/workflows/   # CI
```

`apps/android` y `apps/ios` no existen en el MVP. Cuando se creen, vivirán fuera del toolchain de pnpm (Gradle y Xcode) y compartirán con el resto solo el contrato de la API (OpenAPI, ADR-0018) y, posiblemente, los textos de `packages/i18n` exportados como JSON.

Reglas de dependencia:

- `apps/*` pueden depender de `packages/*`; una app **nunca** depende de otra app.
- `packages/shared` no depende de React ni de ningún framework.
- Las claves con privilegios (`service_role` de Supabase) y el **Client ID de MyAnimeList** (secreto `MAL_CLIENT_ID`) solo existen como variables de entorno del servidor de `apps/api`; **nunca** en `apps/web` ni en `apps/landing`, cuyo código llega al navegador, ni en el repositorio.

## Topología de despliegue: opciones consideradas

### Opción A: Web app → Supabase directo (BaaS), con Edge Functions puntuales (descartada, ADR-0018)

La web app usa el SDK de Supabase en el navegador para autenticarse y consultar Postgres (vía la API REST que Supabase genera). La seguridad se resuelve con políticas RLS: cada usuario solo lee y escribe sus propias marcas. Las operaciones privilegiadas, como el borrado de cuenta, van en Edge Functions.

- **Ventajas:** sin servidor propio que mantener; mínimo código de backend; encaja con el plazo.
- **Desventajas:** la lógica de negocio queda repartida entre la app y las políticas SQL; acoplamiento al modelo de Supabase.

### Opción B: Web app → API propia → Supabase/Postgres (elegida, ADR-0018)

- **Ventajas:** control total de la lógica y la validación; un único punto de entrada; el cruce entre MAL y las marcas de «visto» se resuelve en el servidor.
- **Desventajas:** otro componente que desarrollar, desplegar y operar; se aparta del objetivo de backend mínimo de D8, por decisión del stakeholder (ADR-0018).

### Diagrama de la Opción B

```
 [Navegador] ──► apps/web (Vercel, archivos estáticos) — app.acruxanime.com
      │
      ├──► Supabase Auth ◄── Google (OAuth con redirección; Apple en la fase nativa, ADR-0015)
      │       └─ el navegador obtiene la sesión (JWT de Supabase)
      │
      ├──► apps/api (Render) — api.acruxanime.com, con el JWT de Supabase
      │       ├──► Supabase Postgres (Prisma, esquema `public`)
      │       │       ├─ perfiles
      │       │       └─ marcas de «visto» por usuario (solo ids de MAL)
      │       ├──► Supabase Auth (administración): borrado de cuenta
      │       └──► API de MyAnimeList v2 (agrega el Client ID secreto)
      │
      └──► Portadas: imágenes del CDN de MAL, tal como las devuelve la API (ADR-0008)

 [Navegador] ──► apps/landing (Vercel) — acruxanime.com: privacidad, soporte, información
                  └─ URL pública de la política de privacidad (también requerida por la pantalla de consentimiento de Google OAuth)
```

### Dominios

El stakeholder compró **`acruxanime.com`** (2026-10-12) y aceptó este esquema:

| URL | Proyecto de Vercel | Contenido |
|---|---|---|
| `acruxanime.com` | `apps/landing` (Astro) | Inicio, política de privacidad, soporte y borrado de cuenta |
| `www.acruxanime.com` | `apps/landing` | Redirección permanente a `acruxanime.com` |
| `app.acruxanime.com` | `apps/web` (React) | Web app |
| `api.acruxanime.com` | Render (`apps/api`) | API propia (ADR-0018) |

- La landing, que es la parte indexable, queda en el dominio raíz; la web app, detrás del login, en un subdominio.
- Las URLs de retorno de OAuth (Supabase Auth y Google) y la URL del sitio en Supabase usan `app.acruxanime.com`; la pantalla de consentimiento de Google declara `acruxanime.com` como dominio autorizado y su política de privacidad.
- Las vistas previas de Vercel (`*.vercel.app`) se registran como URLs de retorno adicionales solo en el entorno de desarrollo.

### Contador total

El contador total (ADR-0009) es un `count` sobre las marcas de «visto» del usuario, calculado por la API. Para el MVP basta con el `count` y una actualización optimista en la app; se revisa si aparece algún problema de rendimiento.

## Decisión

**Pendiente** para la estructura del código. El despliegue ya está decidido: **Opción B**, con API propia en Express y TypeScript (ADR-0018). Propuesta:

- **Código:** la estructura anterior, con sus reglas de dependencia.
- **Despliegue:** **Opción B**, la web app habla con `apps/api`, que accede a Postgres (Supabase) y a MyAnimeList; la web app usa Supabase solo para el login.

## Consecuencias (si se acepta)

- **Positivas:** la lógica de negocio queda en un solo lugar; las apps nativas futuras reutilizan la misma API.
- **Negativas / riesgos:** Prisma se conecta con un rol que omite RLS, por lo que el aislamiento entre usuarios depende de que cada consulta filtre por el `user_id` del JWT; hay que cubrirlo con pruebas de integración. Se bloquea el acceso directo del navegador a las tablas de `public`. Al ejecutarse en el navegador, cualquier clave incluida en la web app es pública: solo se usa la clave anónima, y solo para el login.
- **Acciones derivadas:**
  - Diseñar el esquema (perfiles y `seen_anime(user_id, mal_anime_id, created_at)`) como modelo de Prisma en `apps/api/prisma`, sin políticas RLS para `anon` ni `authenticated`.
  - Implementar la ruta de borrado de cuenta en la API antes del hito del 28-oct (ADR-0014).
  - Definir entornos: propuesta inicial de un proyecto Supabase de desarrollo y uno de producción.

## Preguntas abiertas

- ~~¿Se necesita el proxy `mal-proxy`?~~ Resuelto el 2026-10-12: sí, todas las consultas a MAL pasan por él (ADR-0008); desde ADR-0018 forma parte de la API propia y ya no es una Edge Function. Las portadas se muestran desde el CDN de MAL sin alojarlas.
- ¿Un solo proyecto de Supabase en el MVP o dos (desarrollo y producción)? La capa gratuita limita la cantidad de proyectos activos.
- ~~¿Desarrollo local con la CLI de Supabase (Docker) o directo contra el proyecto de desarrollo?~~ Resuelto el 2026-10-12: sin la CLI de Supabase en local y sin carpeta `supabase/` en el repositorio. Las pruebas de la API usan un Postgres en Docker (ADR-0018) y el login completo se prueba contra un proyecto de Supabase de desarrollo en la nube. Esto implica dos proyectos de Supabase (desarrollo y producción); falta confirmar que la capa gratuita los permite.
