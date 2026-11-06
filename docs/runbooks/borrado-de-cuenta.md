# Borrado de cuenta y exportación de datos

Derechos del titular (ADR-0028, RF-06, RDI-35), issue #38.

## Qué hace

- **`GET /api/v1/me/export`:** descarga `acrux-datos.json` con el perfil y todas las marcas. No incluye el `user_id`, el `analyticsId` ni el token de AniList.
- **`DELETE /api/v1/me`:** borra los datos de la cuenta en tres pasos:
  1. Borra la fila de `profile` en una transacción. Las claves foráneas borran en cascada las marcas, el vínculo con AniList y el plan.
  2. Borra el usuario de Neon Auth con la API de Neon (`DELETE /projects/{project}/branches/{branch}/auth/users/{user}`). Desde ahí ya no se puede iniciar sesión con esa cuenta.
  3. Pide a PostHog que borre a la persona (`POST /api/projects/{project}/persons/bulk_delete/`). PostHog la borra de forma asíncrona. Los eventos se conservan con un id salado que ya no lleva a nadie.
- **Idempotencia:** repetir el borrado no rompe nada.
  - Si Neon falla, la API responde 502 `account.auth_unavailable`, lo reporta a Sentry y la app ofrece reintentar. El reintento termina el trabajo, y un 404 de Neon cuenta como «ya borrado».
  - Si PostHog falla, el borrado igual termina y el error va a Sentry.
  - Mientras el usuario de Neon Auth exista y su JWT siga vigente, cualquier `GET /api/v1/me` vuelve a crear un perfil vacío. La app no lo pide después de borrar. Si tras un 502 se recarga la página, el perfil vuelve vacío hasta que se reintenta el borrado.
- **Sin las credenciales de Neon** la ruta responde 503 `account.unavailable` y no borra nada.
- **Sin las credenciales de PostHog** (o sin `ANALYTICS_ID_SECRET`) se omite el paso 3.
- **En la app** (Perfil → «Borrar cuenta», Figma M19):
  - Se confirma escribiendo BORRAR.
  - Si la sesión de Neon Auth tiene más de 24 horas, primero se vuelve a iniciar sesión (RF-06). La comprobación usa `session.createdAt` del cliente de Neon Auth, porque el JWT que recibe la API no trae la antigüedad de la sesión.
  - Tras borrar, la app olvida a la persona, envía `account_deleted` sin identificar y cierra la sesión.
- **Pendiente:** el aviso de Plus de M19 y la cancelación en Lemon Squeezy llegan con #50.

## Configuración

En el proyecto `app` de Vercel, todas marcadas como *Sensitive*:

| Variable | Production | Preview |
|---|---|---|
| `NEON_API_KEY` | API key de Neon con alcance al proyecto de Acrux (*Project-scoped*) | la misma |
| `NEON_PROJECT_ID` | id del proyecto de Neon | el mismo |
| `NEON_BRANCH_ID` | id de la rama `production` (`br-purple-feather-b5w9mw26`) | el mismo: la rama donde viven los usuarios de Neon Auth |
| `POSTHOG_PERSONAL_API_KEY` | *Personal API key* de PostHog, limitada al proyecto 328147 y al permiso `person:write` | la misma |
| `POSTHOG_PROJECT_ID` | `328147` | `328147` |
| `POSTHOG_API_HOST` | opcional; por defecto `https://eu.posthog.com` | — |

**Ojo con `NEON_BRANCH_ID`:** cada rama de Neon tiene su propio directorio de usuarios, y tiene que ser la rama del Neon Auth que usa la app. Las vistas previas comparten `VITE_NEON_AUTH_URL` y `NEON_AUTH_BASE_URL` con producción, así que sus usuarios viven en la rama `production`, aunque sus datos estén en la base de `dev`.
- Si apuntara a `dev`, Neon respondería 404 y la API lo tomaría como «ya borrado»: el borrado parecería exitoso, pero el usuario podría seguir iniciando sesión.
- Desde una vista previa se borran usuarios reales de Neon Auth. Probar solo con una cuenta de Google de prueba.

## Comprobación (criterio de #38)

1. En una vista previa con las variables, iniciar sesión con una cuenta de prueba, marcar dos franquicias y aceptar la analítica.
2. Perfil → «Descargar mis datos»: el JSON trae el perfil y las dos marcas.
3. Perfil → «Borrar cuenta», escribir BORRAR y confirmar. La app vuelve al inicio con «Borramos tu cuenta y tus datos.».
4. En Neon, en la rama `dev`, `profile` y `mark` ya no tienen filas de ese `user_id`. En la rama `production`, en *Auth → Users*, el usuario ya no existe.
5. En PostHog, la persona con ese `analyticsId` desaparece tras unos minutos, y `account_deleted` aparece sin persona.
6. Iniciar sesión otra vez con la misma cuenta de Google crea una cuenta nueva y vacía.
