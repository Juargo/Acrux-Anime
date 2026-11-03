# Inicio de sesión con Google (Neon Auth)

La SPA inicia sesión con Google mediante Neon Auth (ADR-0034), es decir, Better Auth administrado por Neon. La API verifica el JWT y crea el perfil en la primera llamada a `GET /api/v1/me`.

## Cómo funciona

1. **Ingreso:** la SPA llama a `signIn.social({ provider: 'google' })` de `@neon/auth`. Google vuelve a Neon Auth y Neon Auth vuelve a la SPA, que debe estar en la lista de dominios de confianza.
2. **Token:** `getSession()` entrega el JWT en `session.token`. Dura 15 minutos y el SDK lo renueva solo.
3. **API:** verifica la firma contra `<NEON_AUTH_BASE_URL>/.well-known/jwks.json`, el emisor (el origen de esa URL) y la expiración.
4. **Perfil:** la primera llamada a `GET /api/v1/me` crea el perfil con el nombre y el avatar de Google, la lista privada y el conteo por franquicia. Las llamadas siguientes no lo sobrescriben. El correo nunca se guarda en `profile` ni se devuelve.
5. **Salida:** el cierre de sesión borra la sesión en Neon Auth y la SPA deja de mostrar el perfil.

## Configuración

| Dónde | Qué |
|---|---|
| Neon, rama `production`, *Better Auth* | Activado. Auth URL: `https://ep-round-snow-b5mftgmf.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth` |
| Google Cloud | Pantalla de consentimiento publicada (Acrux, política de privacidad y términos), permisos `openid`, `email` y `profile`. Cliente OAuth web con el URI de redirección `<Auth URL>/callback/google` |
| Neon, proveedor Google | Client ID y Client Secret propios, no los compartidos de Neon |
| Neon, dominios de confianza | `https://app.acruxanime.com` y, mientras se prueba #28, `https://app-git-feat-login-google-juargos-projects.vercel.app`. Nunca `*.vercel.app`: cualquier sitio de Vercel recibiría la sesión. *Allow localhost* desactivado |
| Vercel, proyecto `app` | `VITE_NEON_AUTH_URL` y `NEON_AUTH_BASE_URL` con la Auth URL; `DATABASE_URL` con el rol `acrux_api` |
| `apps/web/vercel.json` | El origen de la Auth URL en `connect-src` de la CSP |

Una sola instancia de Neon Auth, la de `production`, sirve a producción y a las vistas previas. Las vistas previas escriben el perfil en la base de su rama, así que un mismo usuario puede tener perfiles distintos en `dev` y en `production`.

## Pendientes

- **Dependencias:** `@neon/auth` 0.8.0 fija `better-auth` 1.7.6, con avisos de seguridad críticos. `pnpm-workspace.yaml` lo fuerza a 1.7.14. Cuando `@neon/auth` 0.8.2 salga de la cuarentena, después del 2026-11-06, hay que actualizarlo y quitar ese override.
- **Vista previa de prueba:** quitar su dominio de la lista de confianza al cerrar #28.
- **Safari:** si la sesión se pierde en Safari de iPhone, sumar un proxy propio en `/api/auth/*` (ADR-0034).
