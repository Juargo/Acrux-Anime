# @acrux/api

API Express de Acrux, publicada como función de Vercel bajo `/api` (ADR-0018, ADR-0020).

## Scripts

| Script | Uso |
|---|---|
| `pnpm --filter @acrux/api dev` | API local en `http://localhost:3001` |
| `pnpm --filter @acrux/api test` | Pruebas. Las de la base levantan Postgres 17 en Docker (testcontainers), así que Docker debe estar corriendo. |
| `pnpm --filter @acrux/api db:deploy` | Aplica las migraciones pendientes con `DATABASE_URL_UNPOOLED` |

## Base de datos (ADR-0022, ADR-0034)

- **Conexiones:**
  - `DATABASE_URL`: cadena **con pooler** de Neon y el rol `acrux_api`. La usa la API en tiempo de ejecución.
  - `DATABASE_URL_UNPOOLED`: cadena **directa** con el rol propietario. Solo la usan las migraciones, desde CI.
- **Rol `acrux_api`:** lo crea la migración inicial **sin login**. En cada rama de Neon se le da login y contraseña una sola vez, con el rol propietario: `ALTER ROLE acrux_api WITH LOGIN PASSWORD '<secreto>';`. La contraseña solo vive en las variables de entorno de Vercel. No se crea con la consola ni con la API de Neon, porque así quedaría dentro de `neon_superuser`.
- **RLS:** todas las tablas de `public` tienen RLS activado. La única política es `acrux_api_all`, solo para `acrux_api`. Cualquier otro rol que no sea el propietario no puede leer ni escribir.

### Al agregar una tabla nueva

En la misma migración que la crea:

1. `GRANT SELECT, INSERT, UPDATE, DELETE ON "<tabla>" TO acrux_api;`
2. `ALTER TABLE "<tabla>" ENABLE ROW LEVEL SECURITY;`
3. `CREATE POLICY "acrux_api_all" ON "<tabla>" TO acrux_api USING (true) WITH CHECK (true);`

Las pruebas de `src/db/migrations.test.ts` fallan si una tabla de `public` queda sin RLS.
