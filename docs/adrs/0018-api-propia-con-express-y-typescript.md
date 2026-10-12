# ADR-0018: API propia con Express y TypeScript como intermediaria con MyAnimeList

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-12

**Reemplaza parcialmente:**

- ADR-0008, sección «Acceso a la API mediante el proxy `mal-proxy`»: el proxy deja de ser una Edge Function y pasa a ser esta API. Sus reglas se conservan (ver «Reglas heredadas de `mal-proxy`»).
- ADR-0006 y ADR-0007, acción derivada «Edge Function para el borrado de cuenta»: el borrado de cuenta pasa a esta API.
- ADR-0017, operación «año completo» en `mal-proxy`: pasa a esta API.

## Contexto

La topología propuesta en ADR-0004 (Opción A) conectaba la web app directamente con Supabase y resolvía las operaciones privilegiadas con Edge Functions. El stakeholder decide tener una **API propia** que:

1. **Intermedie con MyAnimeList:** el navegador nunca llama a MAL (ADR-0008); la API agrega el Client ID en el servidor.
2. **Cruce el catálogo con los datos del usuario:** al devolver animes de MAL, marca cuáles ya vio el usuario según `seen_anime`, de modo que la web app recibe una sola respuesta lista para mostrar.
3. **Gestione las cuentas:** perfil, marcas de «visto» y borrado de cuenta.

Sobre «obtener la lista completa de animes»: la API de MAL **no ofrece un listado completo** (el spike de ADR-0008 confirmó que `GET /anime` exige `q` de al menos 3 caracteres). La «lista» que expone la API es la exploración definida en ADR-0017, cuya **base es el año de estreno**: por defecto se muestran los animes estrenados en el año en curso, y el usuario puede retroceder año a año hasta 1917 o buscar por nombre. Cada resultado se devuelve enriquecido con su estado de «visto».

Como referencia de stack se toma la API de otro proyecto del stakeholder (`mirach-api`), **excepto Clean Architecture**.

## Opciones consideradas

### Opción A: Web app → Supabase directo, con Edge Functions puntuales (ADR-0004, Opción A)

- **Ventajas:** sin servidor propio que mantener; mínimo código de backend.
- **Desventajas:** el cruce entre MAL y las marcas del usuario queda en el navegador (dos fuentes, dos peticiones); la lógica queda repartida entre la app, las políticas RLS y funciones Deno; no reutiliza la experiencia del stakeholder con Express.

### Opción B: Web app → API propia en Express → MAL y Postgres (Supabase)

- **Ventajas:** un único punto de entrada con la lógica de negocio en un solo lugar; el cruce MAL + «visto» se resuelve en el servidor; stack ya conocido y probado por el stakeholder; la misma API sirve a las apps nativas futuras.
- **Desventajas:** un componente más que desplegar, operar y asegurar; más trabajo antes del hito del 28-oct (ADR-0014).

## Decisión

**Opción B.** Se crea `apps/api`, una API en Express y TypeScript con este stack:

### Runtime y lenguaje

- **Node 22** (fijado en `.node-version`) y **TypeScript** en modo estricto.
- **pnpm 11** con workspaces, dentro del monorepo (ADR-0002).

### HTTP

- **Express**, con una fábrica `createApp(container)`, una cadena de middlewares (sesión → errores) y rutas en `routes/*.routes.ts`.
- **Contrato OpenAPI** emitido a `apps/api/openapi.json` (`openapi:emit`) y verificado en CI (`openapi:check`).
- **Zod 4 + `zod-openapi`** (decisión del stakeholder, 2026-10-12): cada ruta define sus esquemas Zod, que validan la petición en tiempo de ejecución, dan los tipos de TypeScript y generan el contrato con `createDocument`. Es la misma combinación que usa `mirach-api`. Se descartaron `@asteasolutions/zod-to-openapi` (mismo enfoque, sin ventaja adicional), tsoa (requiere decoradores) y la especificación escrita a mano (se desincroniza del código).

### Organización del código

- **Sin Clean Architecture** (decisión del stakeholder). El código se organiza por módulo funcional (`catalog`, `seen`, `account`), cada uno con sus rutas, servicios y acceso a datos.
- `Result<T, E>` en lugar de excepciones en los servicios; el middleware de errores traduce los fallos a respuestas HTTP.
- Dependencias conectadas a mano en `composition/container.ts`, sin decoradores ni framework de inyección.

### Datos

- **Prisma** como ORM sobre el **PostgreSQL de Supabase**. Prisma gestiona solo el esquema `public` (perfiles y `seen_anime`); el esquema `auth` sigue siendo de Supabase Auth.
- Conexión en tiempo de ejecución por el pooler de Supabase; las migraciones usan la conexión directa.

### Autenticación y cuentas

- El login sigue en **Supabase Auth con Google** (ADR-0006, ADR-0015). La web app obtiene la sesión de Supabase y envía su JWT a la API.
- La API **verifica el JWT de Supabase** en un middleware de sesión y rechaza las peticiones sin usuario autenticado.
- El **borrado de cuenta** (ADR-0007) es una ruta de la API, que usa la clave `service_role` para borrar el usuario de Supabase Auth y sus datos.

### Reglas heredadas de `mal-proxy` (ADR-0008)

- El Client ID de MAL (`MAL_CLIENT_ID`) y la clave `service_role` son **variables de entorno del servidor**: nunca en el repositorio, en variables `VITE_*` ni en el código de `apps/web`.
- La API solo llama a una **lista cerrada de endpoints y campos** de MAL; no es un proxy abierto.
- CORS solo para `app.acruxanime.com` y las vistas previas de desarrollo.
- Consulta agrupada por lista de ids para la lista de vistos y la imagen para compartir.
- Caché de las respuestas de MAL (incluido el «año completo» de ADR-0017) y cabeceras `Cache-Control`, para no imponer una carga irrazonable a MAL.

### Pruebas

- **Vitest** para pruebas unitarias, de integración y E2E de la API.
- **Docker** para el Postgres local de pruebas; no se usa la CLI de Supabase en local (ADR-0004).
- Las pruebas no levantan Supabase Auth: firman JWT con una clave de prueba que la API verifica igual que en producción, y reemplazan la llamada de borrado de usuario en Supabase Auth por un doble de prueba.
- `seen_anime.user_id` es un `uuid` sin clave foránea a `auth.users`, ya que ese esquema no existe en el Postgres de pruebas.
- El flujo completo de login (Google → Supabase Auth → web app → API) se prueba contra un proyecto de Supabase de desarrollo en la nube.

### Infraestructura y CI

- Despliegue en **Render**, con despliegue automático desde `main`, en la misma región que el proyecto de Supabase. Dominio propuesto: `api.acruxanime.com`.
- GitHub Actions con: Semgrep (SAST), Schemathesis + ZAP (DAST), auditoría de dependencias, escaneo de secretos, commitlint y release-please.
- husky + lint-staged en local.

### Elementos de la referencia que no se adoptan

| Elemento | Motivo |
|---|---|
| Clean Architecture | Decisión del stakeholder. |
| Gatekeeper `x-api-key` | La web app es una SPA: cualquier clave incluida en su código es pública y no protege nada. El control de acceso es el JWT de Supabase más CORS. |
| multer, ExcelJS y parsing de PDF | Acrux no recibe archivos ni procesa documentos. |
| Cifrado en reposo de campos (`CryptoService`) | Acrux solo guarda ids de MAL y fechas; no hay campos sensibles que cifrar. |
| Sign in with Apple y login con contraseña | El MVP web usa solo Google (ADR-0015). |

## Consecuencias

- **Positivas:**
  - La web app hace una sola petición por pantalla y recibe los animes ya marcados como vistos.
  - La lógica de negocio queda en un solo lugar, con un contrato OpenAPI verificable.
  - Las apps nativas futuras consumen la misma API.
- **Negativas / riesgos:**
  - Un servidor más que operar: disponibilidad, actualizaciones y seguridad corren por cuenta del proyecto.
  - Prisma se conecta con un rol que **omite RLS**: el aislamiento entre usuarios depende de que cada consulta filtre por el `user_id` del JWT. Se cubre con pruebas de integración.
  - Si el plan de Render suspende el servicio por inactividad, la primera petición tras la suspensión tarda varios segundos.
  - Más trabajo antes del hito del 28-oct (ADR-0014).
- **Acciones derivadas:**
  - Crear `apps/api` con el stack anterior y el pipeline de CI.
  - Implementar las rutas de exploración (por nombre y por año), marcas de «visto», perfil y borrado de cuenta.
  - Bloquear el acceso directo desde el navegador a las tablas de `public` (sin políticas RLS para `anon` ni `authenticated`), ya que todo pasa por la API.
  - ~~Elegir la herramienta que genera el contrato OpenAPI.~~ Resuelto el 2026-10-12: Zod 4 + `zod-openapi` (ver «HTTP»).
  - Actualizar ADR-0003 y ADR-0004 (en `Propuesto`) con esta decisión.
