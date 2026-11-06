# @acrux/api

API Express de Acrux, publicada como función de Vercel bajo `/api` (ADR-0018, ADR-0020).

## Scripts

| Script | Uso |
|---|---|
| `pnpm --filter @acrux/api dev` | API local en `http://localhost:3001` |
| `pnpm --filter @acrux/api test` | Pruebas. Las de la base levantan Postgres 17 en Docker (testcontainers), así que Docker debe estar corriendo. |
| `pnpm --filter @acrux/api db:deploy` | Aplica las migraciones pendientes con `DATABASE_URL_UNPOOLED` |
| `pnpm --filter @acrux/api openapi:emit` | Regenera `openapi.json` a partir de las rutas. Hay que commitearlo; la CI lo verifica con `openapi:check`. |
| `pnpm --filter @acrux/api depcruise` | Verifica las reglas de capas de ADR-0019 (también en CI) |

## Rutas (ADR-0019, ADR-0023, ADR-0025)

- Cada módulo de `src/modules/<módulo>` exporta sus rutas; `createApp(container)` las monta.
- **Toda ruta es privada** salvo que declare `public: true`: sin un JWT válido de Neon Auth responde `401` (`auth.missing_token` o `auth.invalid_token`). Mientras falte `NEON_AUTH_BASE_URL`, las rutas privadas responden `503 auth.unavailable`.
- Cada ruta declara `docs` (resumen y respuestas con Zod) para el contrato OpenAPI.
- Los errores salen en `application/problem+json` con un `code` estable; para devolver uno, lanzá `new ProblemError(status, code, title)`.
- Cada respuesta lleva `X-Request-Id`. El log por petición nunca recibe cabeceras ni cuerpos.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Pooler de Neon con `acrux_api` (tiempo de ejecución) |
| `DATABASE_URL_UNPOOLED` | Conexión directa con el rol propietario (solo migraciones, CI) |
| `NEON_AUTH_BASE_URL` | Base de Neon Auth; el JWKS se lee de `<base>/.well-known/jwks.json` (#28) |
| `NEON_AUTH_ISSUER` | Emisor esperado del JWT; por defecto, `NEON_AUTH_BASE_URL` |
| `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID` | Borran el usuario de Neon Auth al borrar la cuenta. Sin las tres, `DELETE /api/v1/me` responde 503 ([runbook](../../docs/runbooks/borrado-de-cuenta.md)) |
| `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST` | Borran la persona de PostHog al borrar la cuenta. Son opcionales; el host es `https://eu.posthog.com` por defecto |
| `LOG_LEVEL` | Nivel de `pino` (por defecto `info`) |

## Base de datos (ADR-0022, ADR-0034)

- **Conexiones:**
  - `DATABASE_URL`: cadena **con pooler** de Neon y el rol `acrux_api`. La usa la API en tiempo de ejecución.
  - `DATABASE_URL_UNPOOLED`: cadena **directa** con el rol propietario. Solo la usan las migraciones, desde CI.
- **Rol `acrux_api`:** lo crea la migración inicial **sin login**. En cada rama de Neon se le da login y contraseña una sola vez, con el rol propietario: `ALTER ROLE acrux_api WITH LOGIN PASSWORD '<secreto>';`. La contraseña solo vive en las variables de entorno de Vercel. No se crea con la consola ni con la API de Neon, porque así quedaría dentro de `neon_superuser`.
- **Rol `acrux_backup`:** solo lectura, para el respaldo semanal. Lo crea una migración **sin login** y con `BYPASSRLS`, porque `pg_dump` falla si RLS le oculta filas. El login solo se le da en `production`; ver [el runbook de respaldos](../../docs/runbooks/respaldos.md).
- **RLS:** todas las tablas de `public` tienen RLS activado. La única política es `acrux_api_all`, solo para `acrux_api`. Fuera del propietario y de `acrux_backup`, que solo lee, ningún otro rol puede leer ni escribir.

### Al agregar una tabla nueva

En la misma migración que la crea:

1. `GRANT SELECT, INSERT, UPDATE, DELETE ON "<tabla>" TO acrux_api;`
2. `ALTER TABLE "<tabla>" ENABLE ROW LEVEL SECURITY;`
3. `CREATE POLICY "acrux_api_all" ON "<tabla>" TO acrux_api USING (true) WITH CHECK (true);`

Las pruebas de `src/db/migrations.test.ts` fallan si una tabla de `public` queda sin RLS.
