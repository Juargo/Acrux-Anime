# ADR-0020: Topología de despliegue: Vercel (web, API y landing) y Supabase

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27

**Reemplaza:**

- La topología de despliegue de ADR-0004 (diagrama de la Opción B y tabla de dominios).
- ADR-0018, sección «Infraestructura y CI»: despliegue de la API en Render. El resto de ADR-0018 (Express, Zod, Prisma, organización del código) sigue vigente.

## Contexto

- Presupuesto cercano a cero (RES-03, RNF-61).
- ADR-0018 desplegaba la API en Render. En la capa gratuita de Render el servicio se suspende tras un periodo de inactividad y la primera petición tarda varios segundos, lo que choca con RNF-11 (marcar se percibe instantáneo).
- La web app (React + Vite, ADR-0003) y la landing (Astro, ADR-0012) ya iban en Vercel.
- **El plan Hobby (gratis) de Vercel es solo para uso no comercial.** Cobrar Plus convierte a Acrux en un uso comercial.
- Mientras no exista autorización de AniList, Plus no se cobra (riesgo R-01 de Restricciones; ADR-0024). Durante la validación y la beta, Acrux no genera ingresos.

## Opciones consideradas

| Opción | Costo | Comentario |
|---|---|---|
| **Vercel Hobby → Pro** | US$0 mientras no haya ingresos; US$20/mes en Pro | Un solo proveedor para web, API y landing; stack conocido; despliegues de vista previa por PR. Hay que pasar a Pro antes de cobrar. |
| Cloudflare Pages + Workers | US$0, uso comercial permitido | Requiere adaptar Express y Prisma al runtime de Workers; más fricción para una persona. |
| Vercel (web) + Render (API) | US$0 | Dos proveedores; la suspensión por inactividad de Render perjudica RNF-11. |
| VPS barato (Hetzner u otro) | ~US$4–5/mes | Operar el sistema operativo, TLS, parches y respaldos corre por cuenta propia. |

## Decisión

**Vercel** para todo lo que se despliega, en **Hobby** mientras no haya ingresos, y en **Pro antes del primer cobro de Plus**. **Supabase** (capa gratuita) para Auth y Postgres (ADR-0006, ADR-0022).

### Proyectos y dominios

| URL | Proyecto de Vercel | Contenido |
|---|---|---|
| `acruxanime.com` | `landing` (`apps/landing`, Astro) | Landing de validación, lista de espera, privacidad, soporte y borrado de cuenta |
| `www.acruxanime.com` | `landing` | Redirección permanente a `acruxanime.com` |
| `app.acruxanime.com` | `app` (`apps/web` + `apps/api`) | La SPA como archivos estáticos y la API Express como función de Vercel bajo `/api/*` |

La API se publica **en el mismo origen que la web app** (`app.acruxanime.com/api`), en lugar de `api.acruxanime.com`:

- **Sin CORS:** el navegador no hace peticiones entre orígenes a la API propia.
- **Versiones atómicas:** cada despliegue publica juntas la SPA y la API que le corresponde; no hay desfase entre cliente y contrato.

### Diagrama

```
 [Navegador] ──► app.acruxanime.com (Vercel, proyecto «app»)
      │             ├─ /*      SPA React (estática, CDN de Vercel)
      │             └─ /api/*  API Express (función de Vercel) ──► Supabase Postgres (pooler, Prisma)
      │                                                       ├──► Supabase Auth (admin: borrado de cuenta)
      │                                                       ├──► AniList OAuth (vínculo opcional)
      │                                                       └──◄ Lemon Squeezy (webhooks firmados)
      ├──► Supabase Auth ◄── Google (OAuth con PKCE)
      ├──► graphql.anilist.co (catálogo, directo desde el navegador, ADR-0024)
      ├──► Portadas desde el CDN de AniList
      └──► PostHog y Sentry (ADR-0030)

 [Navegador] ──► acruxanime.com (Vercel, proyecto «landing»)
```

### Entornos

| Entorno | Vercel | Supabase |
|---|---|---|
| Local | `vercel dev` o Vite + API local | Postgres en Docker para pruebas (ADR-0018); proyecto de desarrollo para el login |
| Vista previa (por PR) | Despliegue de vista previa | Proyecto de **desarrollo** |
| Producción | Despliegue de `main` | Proyecto de **producción** |

La capa gratuita de Supabase permite dos proyectos activos; con eso se resuelve la pregunta abierta de ADR-0004.

### Región

Las funciones de Vercel y el proyecto de Supabase van en **la misma región**, para que cada consulta de la API a Postgres no cruce continentes. Región elegida (2026-10-27): **São Paulo**, `sa-east-1` en Supabase y `gru1` en Vercel, por latencia desde Chile y Latinoamérica.

### Disparadores de cambio de plan

| Disparador | Acción | Costo |
|---|---|---|
| Primer cobro de Plus (requiere la autorización y la licencia de AniList) | Vercel Pro | US$20/mes |
| Base de datos cerca de 500 MB, o se necesitan respaldos con recuperación a un punto en el tiempo | Supabase Pro | US$25/mes |
| Superar los límites de Hobby (ancho de banda o ejecución de funciones) | Vercel Pro | US$20/mes |

## Consecuencias

- **Positivas:** costo de US$0 en la validación y la beta; un solo proveedor de despliegue; vistas previas por PR para probar con Playwright (ADR-0027); sin arranque en frío de un servidor suspendido.
- **Negativas / riesgos:**
  - **Dependencia de Vercel**, que se mitiga porque la API es Express estándar y se puede mover a otro hosting de Node sin reescribirla.
  - Las funciones de Vercel tienen arranque en frío (bastante menor que la suspensión de Render). Se mitiga con la actualización optimista en la SPA (RNF-11).
  - Un proyecto de Supabase gratuito se **pausa tras una semana sin actividad**. En producción con usuarios no ocurre; en desarrollo hay que reactivarlo a mano.
  - Al pasar a Pro, el costo fijo mínimo será de unos US$20/mes, que Plus debe cubrir.
- **Acciones derivadas:**
  - Configurar el proyecto `app` de Vercel en el monorepo: Vite como salida estática y la API como función Express bajo `/api`.
  - Mover las URLs de retorno de OAuth y la URL del sitio en Supabase a `app.acruxanime.com`; ya no se crea `api.acruxanime.com`.
  - Fijar la región de las funciones de Vercel igual a la de Supabase.
  - Agregar el paso a Vercel Pro como requisito previo del hito «cobrar Plus».
