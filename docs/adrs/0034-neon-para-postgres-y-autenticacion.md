# ADR-0034: Neon para Postgres y autenticación, en lugar de Supabase

- **Estado:** Aceptado
- **Fecha:** 2026-10-28
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-28 («Voy a cambiar supabase por neon»; «Ahora usemos neon Auth»). Motivo declarado: falta de presupuesto para seguir usando Supabase.

**Reemplaza:**

- ADR-0006 completo: Supabase deja de ser el proveedor de Postgres y de autenticación.
- ADR-0020, en lo referido a Supabase: proyectos, región de la base y escalamiento de la base.
- ADR-0022, en lo referido a Supabase: proveedor, pooler y Data API. Siguen vigentes PostgreSQL, Prisma, el modelo de datos, RLS activado sin políticas y los respaldos semanales en Cloudflare R2 (con la retención de ADR-0032).
- ADR-0025, en lo referido a Supabase Auth: inicio de sesión, verificación del JWT, rol de curador y borrado del usuario. Siguen vigentes la autorización denegada por defecto, `requirePlan`, `requireRole`, el vínculo con AniList y Lemon Squeezy.
- ADR-0026, filas de base de datos, ORM y autenticación.

## Contexto

- La capa gratuita de Supabase permite dos proyectos activos y los dos cupos de la cuenta del stakeholder ya están ocupados (ADR-0033). Liberar un cupo o pasar a Supabase Pro (US$25/mes por organización) no cabe en el presupuesto cercano a cero de la validación (ADR-0031).
- El plan gratuito de Neon permite hasta 20 proyectos, cada uno con 0,5 GB de almacenamiento y 100 horas de cómputo (CU-hora) al mes, con escalado a cero (documentación de Neon, consultada el 2026-10-28).
- Neon incluye **Neon Auth** (Managed Better Auth): inicio de sesión con Google, usuarios guardados en el esquema `neon_auth` de la misma base y JWT verificable con JWKS. El plan gratuito cubre hasta 60.000 usuarios activos al mes.
- El 2026-10-28 ya se creó y enlazó el proyecto de Neon `Acrux-Anime` (`flat-term-87467182`, rama `production`, PostgreSQL 18) con `neon init` y `neon deploy`.

## Opciones consideradas

| Opción | Resultado | Motivo |
|---|---|---|
| Seguir en Supabase (liberar un cupo o pasar a Pro) | Descartada | Obliga a pausar otro proyecto del stakeholder o a pagar US$25/mes antes de validar la demanda. |
| Neon Postgres + Better Auth o Auth.js en la API | Descartada | Más código y más superficie de seguridad propia (ya descartada en ADR-0025). |
| **Neon Postgres + Neon Auth** | **Elegida** | US$0 en el plan gratuito; la autenticación es administrada y queda en el mismo proveedor que la base. |

## Decisión

**Neon** es el proveedor de PostgreSQL y de autenticación, con **Neon Auth** para el inicio de sesión con Google (ADR-0015).

### Base de datos

1. **Proyecto:** `Acrux-Anime` en Neon, en la región **AWS US East (Ohio)** (`aws-us-east-2`). Se configura como código en `neon.ts` (`@neon/config`).
2. **Entornos como ramas de Neon:** `production` es la rama por defecto; desarrollo y vistas previas usan ramas creadas desde ella (`neon checkout dev --create`), con vencimiento automático de 7 días para ramas nuevas. Reemplaza los dos proyectos de Supabase de ADR-0020.
3. **Conexiones:** en tiempo de ejecución, la API usa la cadena **con pooler** (`DATABASE_URL`, PgBouncer en modo transacción). Las migraciones de Prisma usan la cadena **directa** (`DATABASE_URL_UNPOOLED`). Las variables se obtienen con `neon env pull`; `.env.local` no se versiona.
4. **Sin Data API:** no se activa la Data API de Neon. El navegador nunca habla con Postgres; solo la API, con Prisma (ADR-0022). RLS sigue activado sin políticas como defensa en profundidad.
5. **Respaldos:** siguen el `pg_dump` semanal cifrado a Cloudflare R2 con 30 días de retención (ADR-0022, ADR-0032). La restauración instantánea del plan gratuito de Neon cubre solo 6 horas.

### Autenticación con Neon Auth

1. La SPA inicia sesión con el cliente de Neon Auth: `signIn.social({ provider: 'google' })`. En producción, la URL de retorno debe ser un dominio de confianza (`app.acruxanime.com`).
2. Cada petición a la API lleva `Authorization: Bearer <JWT de Neon Auth>`.
3. La API **verifica la firma del JWT** con `jose` contra el JWKS de Neon Auth (`<NEON_AUTH_BASE_URL>/.well-known/jwks.json`), además del emisor (`iss`) y la expiración. No confía en ningún dato del token sin verificarlo.
4. El `sub` del token (el `id` en `neon_auth.user`) es el `user_id` en todas las tablas de `public` (ADR-0022).
5. **Curador:** se asigna como rol del usuario de Neon Auth, solo desde la consola o la CLI de Neon (`neon neon-auth user set-role`). El usuario no puede cambiarlo. El *middleware* `requireRole('curator')` sigue igual; si el rol no viene en el JWT, la API lo lee de `neon_auth.user`.
6. **Borrado de cuenta:** `DELETE /api/v1/me` borra en una transacción los datos de `public` y luego el usuario de Neon Auth con la API administrativa de Neon. La credencial administrativa solo existe en el servidor (ADR-0007, ADR-0018).

### Filas actualizadas del stack (ADR-0026)

| Capa | Elección | Costo | ADR |
|---|---|---|---|
| ORM | Prisma sobre la cadena con pooler de Neon | — | ADR-0018, ADR-0022, ADR-0034 |
| Base de datos | PostgreSQL (Neon) | Gratis → plan de pago de Neon | ADR-0022, ADR-0034 |
| Autenticación | Neon Auth (Google), JWT verificado con `jose` | Gratis hasta 60.000 usuarios activos al mes | ADR-0025, ADR-0034 |

### Equivalencias en los demás ADRs

Las menciones a Supabase en ADRs que siguen vigentes se leen así:

| Dice | Se lee |
|---|---|
| Supabase Auth (ADR-0015, ADR-0019, ADR-0028, ADR-0029) | Neon Auth |
| Pooler de Supabase en modo transacción (ADR-0021, ADR-0022) | Cadena con pooler de Neon (`DATABASE_URL`) |
| Panel de Supabase y alerta al 80 % del almacenamiento (ADR-0021, ADR-0030) | Consola de Neon, sobre 0,5 GB por proyecto |
| `pg_cron` de Supabase (ADR-0019) | Vercel Cron o `pg_cron` de Neon |
| Supabase Realtime (ADR-0023) | Sin equivalente decidido; si aparece un caso de tiempo real, se registra un ADR |
| Supabase como encargado del tratamiento (ADR-0028) | Neon |
| Clave anónima de Supabase en el navegador (ADR-0028) | URL pública de Neon Auth; ningún secreto en el navegador |

## Consecuencias

- **Positivas:**
  - US$0 en H1 y H2, sin pausar otros proyectos del stakeholder.
  - Ramas de Neon para desarrollo y vistas previas, sin un segundo proyecto.
  - La base de datos y la autenticación quedan en un solo proveedor y en la misma base.
- **Negativas / riesgos:**
  - **La base queda en Ohio y la API en São Paulo (`gru1`, ADR-0020).** Cada consulta cruza el continente, lo que suma latencia. El stakeholder decidió mantenerlo así por ahora (2026-10-28). Se revisa antes de H2 con mediciones reales. La región de un proyecto de Neon no se puede cambiar: moverla implica crear otro proyecto y migrar.
  - **Escalado a cero:** tras un rato sin actividad, la primera consulta paga el arranque del cómputo.
  - **0,5 GB por proyecto**, contra los 500 MB de Supabase: margen similar (ADR-0021). Al superarlo, toca pasar a un plan de pago de Neon.
  - La sesión de Neon Auth también es robable con un XSS. Se mantiene la CSP estricta de ADR-0028, ahora con el dominio de Neon Auth en `connect-src`.
  - Hay que confirmar en un spike que el rol viaja en el JWT y cuál es la API administrativa para borrar usuarios.
- **Acciones derivadas:**
  - Activar Neon Auth en `neon.ts` (`auth`) y configurar Google con credenciales propias para producción.
  - Spike: claims del JWT de Neon Auth (`sub`, rol, audiencia) y borrado de usuario desde el servidor.
  - Actualizar los issues que suponen Supabase (#10, #15, #22, #27, #28 y los que lo mencionen).
  - Agregar Neon como encargado del tratamiento en la política de privacidad (D42 y M42 en Figma).
  - Medir la latencia entre `gru1` y Ohio antes de H2.
