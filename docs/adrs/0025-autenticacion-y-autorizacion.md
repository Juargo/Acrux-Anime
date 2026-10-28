# ADR-0025: Autenticación y autorización

- **Estado:** Aceptado (Supabase Auth reemplazado por Neon Auth en ADR-0034: inicio de sesión, verificación del JWT, rol de curador y borrado del usuario)
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Se apoya en ADR-0006 (Supabase), ADR-0015 (solo Google en el MVP web) y ADR-0018 (verificación del JWT en la API).

## Contexto

- **Identidad:** login solo con Google en la primera versión (ADR-0015, decisión del 26-oct-2026). Apple queda para la app iOS futura.
- **AniList es opcional:** se vincula después del login para sincronizar la lista (RF-02, RF-03); no es un medio de inicio de sesión.
- **Roles** (Usuarios, Roles y Personas): Visitante, Usuario gratuito, Usuario Plus y Curador. Matriz de permisos en ese documento.
- **Pagos:** Plus se cobra con Lemon Squeezy (plan anual y vitalicio, sin prueba gratis), no con las tiendas.
- Prisma no aplica RLS (ADR-0022): la autorización debe vivir en la API.

## Opciones consideradas

| Opción | Resultado | Motivo |
|---|---|---|
| **Supabase Auth (Google) + verificación del JWT en la API** | **Elegida** | Incluido en la capa gratuita; sin contraseñas que gestionar; la API verifica el token con la clave pública de Supabase. |
| Better Auth o Auth.js en la API | Descartada | Más código y más superficie de seguridad propia; el stakeholder eligió Supabase. |
| Login con AniList como identidad | Descartada | AniList es opcional (decisión del 26-oct-2026). |

## Decisión

### Autenticación

1. La SPA inicia sesión con `signInWithOAuth({ provider: 'google' })` de Supabase Auth, con **flujo PKCE**.
2. Cada petición a la API lleva `Authorization: Bearer <access token de Supabase>`.
3. La API **verifica la firma del JWT** con las claves públicas del proyecto (JWKS de Supabase, con `jose`), además del emisor (`iss`), la audiencia (`aud = authenticated`) y la expiración. No confía en ningún dato del token sin verificarlo.
4. El `sub` del token es el `user_id` en todas las tablas (ADR-0022).
5. Tokens de acceso de vida corta (la duración por defecto de Supabase) con renovación automática del SDK.

### Autorización: denegada por defecto

1. **Toda ruta exige un usuario autenticado salvo que se marque como pública de forma explícita** (`public: true` en la definición de la ruta). Hoy son públicas solo `GET /api/v1/profiles/{handle}`, `GET /api/health` y el webhook, que se autentica con firma HMAC.
2. **Propiedad del recurso:** las rutas `/me/*` toman el `user_id` **solo del JWT**, nunca de la URL ni del cuerpo. Los repositorios exigen `userId` como parámetro obligatorio, de modo que no exista una consulta de datos de usuario sin ese filtro.
3. **Plan (Plus):** un *middleware* `requirePlan('plus')` lee `entitlement` en la base. El estado de Plus **nunca** se toma del cliente ni del JWT.
4. **Curador:** se identifica con el claim `app_metadata.role = 'curator'`, que solo se puede asignar desde el panel o la API administrativa de Supabase (el usuario no puede modificar `app_metadata`). Un *middleware* `requireRole('curator')` protege la edición de `franchise_override` y las métricas internas.
5. **Visitante:** solo lee el perfil público. Si la lista es privada, la API responde `404` (no `403`), para no confirmar que existe (RNF-31).

| Permiso | Mecanismo |
|---|---|
| Ver perfil público | Ruta pública + `list_visibility = 'public'` |
| Marcar, contador, lista, tarjeta básica | Usuario autenticado + filtro por `user_id` |
| Temas, estadísticas, Wrapped (Plus) | `requirePlan('plus')` con `entitlement.valid_until` vigente |
| Tabla global de correcciones, métricas | `requireRole('curator')` |

### Vínculo con AniList

- OAuth de AniList con **código de autorización**, intercambiado en la API (`POST /api/v1/anilist/link`): el *client secret* nunca llega al navegador.
- El token de AniList se guarda **cifrado** (AES-256-GCM, con la clave en una variable de entorno del servidor) en `anilist_link`. Nunca aparece en logs ni en respuestas.
- Desvincular o borrar la cuenta elimina el token (RNF-32, RDI-35).

### Plus con Lemon Squeezy

- El checkout lo crea la API con el `user_id` en los datos personalizados; Lemon Squeezy lo devuelve en los webhooks.
- El webhook verifica la firma HMAC (`X-Signature`) **antes** de leer el cuerpo, descarta eventos repetidos (`billing_event`) y actualiza `entitlement` en una transacción (ADR-0022).

### Borrado de cuenta

`DELETE /api/v1/me` borra, en una transacción, los datos de `public` y luego el usuario de Supabase Auth con la clave `service_role`, que solo existe en el servidor (ADR-0007, ADR-0018).

## Consecuencias

- **Positivas:** sin contraseñas ni datos de tarjetas (RNF-36); autorización centralizada y denegada por defecto; el plan y el rol se deciden siempre en el servidor.
- **Negativas / riesgos:**
  - El aislamiento entre usuarios depende del código de la API: se cubre con pruebas de integración que intentan leer y modificar datos de otro usuario (ADR-0029).
  - La sesión de Supabase vive en el almacenamiento del navegador: un XSS podría robarla. Se mitiga con una CSP estricta y sin HTML sin sanitizar (ADR-0028).
- **Acciones derivadas:**
  - Implementar el *middleware* de sesión con JWKS y los *middlewares* `requirePlan` y `requireRole`.
  - Spike del intercambio de código OAuth de AniList y de los permisos que solicita.
  - Configurar los webhooks de Lemon Squeezy con un secreto por entorno.
