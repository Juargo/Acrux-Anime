# ADR-0022: Base de datos: PostgreSQL relacional (ACID) en Supabase, con Prisma

- **Estado:** Aceptado (retención de 4 semanas de los respaldos reemplazada por ADR-0032; Supabase, su pooler y su Data API reemplazados por Neon en ADR-0034)
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Complementa ADR-0006 (Supabase) y ADR-0018 (Prisma).

## Contexto

Acrux guarda pocos datos, pero con relaciones claras y reglas de integridad (Requisitos de Datos e Integración, RDI-10 a RDI-16):

- Cuenta, perfil, vínculo con AniList y plan: **uno a uno con el usuario**.
- Marcas: **una por usuario y título**, con estado (visto o viendo) y fecha.
- Tabla de correcciones de franquicias del curador (RDI-15).
- Eventos de pago de Lemon Squeezy, que deben procesarse **una sola vez**.

Algunas operaciones deben ser atómicas:

- Marcar una franquicia como vista marca **todas las entradas de su núcleo** (RDI-31): o se marcan todas o ninguna.
- El contador debe coincidir siempre con la lista visible (RNF-42) y no puede haber marcas duplicadas (RNF-40).
- Activar Plus a partir de un webhook no debe duplicarse si el webhook llega dos veces.
- Borrar la cuenta elimina todos los datos del usuario (RDI-35).

No se almacena el catálogo (RES-22, RDI-20).

## Opciones consideradas

| Opción | Resultado | Motivo |
|---|---|---|
| **Relacional: PostgreSQL (Supabase)** | **Elegida** | Transacciones ACID, claves únicas, claves foráneas y `CHECK` para las reglas anteriores; ya incluido en Supabase (ADR-0006), gratis. |
| No relacional (documentos o clave-valor) | Descartada | Las reglas de unicidad y atomicidad entre documentos quedarían en el código; no hay datos sin esquema ni escala que lo justifiquen. |
| Vectorial | Descartada | No hay búsqueda semántica ni recomendaciones (están fuera de alcance). Si algún día se necesita, `pgvector` está disponible en el mismo Postgres, sin otra base. |

Para el acceso a los datos se consideraron Prisma, supabase-js con RLS y Drizzle con RLS. El stakeholder eligió **Prisma** (ADR-0018). Prisma se conecta con un rol que **no aplica RLS**, así que la autorización vive en la API (ADR-0025) y RLS queda como defensa en profundidad (ver «Reglas»).

## Decisión

**PostgreSQL de Supabase como única base de datos, accedida solo desde la API con Prisma.**

### Modelo inicial (esquema `public`, gestionado por Prisma)

| Tabla | Claves y restricciones principales |
|---|---|
| `profile` | PK `user_id` (uuid del usuario de Supabase Auth); `display_name`, `avatar_url`, `locale`, `list_visibility` (`private` o `public`), `counter_mode` (`franchise` o `entry`) |
| `mark` | PK `(user_id, anilist_id)`; `mal_id` opcional (RDI-13); `status` (`seen` o `watching`) con `CHECK`; `marked_at` (sirve para el Wrapped) |
| `anilist_link` | PK `user_id`; `anilist_user_id` único; token de acceso **cifrado** (ADR-0025) |
| `entitlement` | PK `user_id`; `plan` (`plus_annual` o `plus_lifetime`), `valid_until`, `lemon_squeezy_customer_id` |
| `billing_event` | PK `event_id` del proveedor: garantiza el procesamiento idempotente de los webhooks |
| `franchise_override` | PK `anilist_id`; `franchise_root_id`, `role` (`core`, `extra` o `separate`); solo la edita el curador |

### Reglas

1. **Transacciones explícitas** (`prisma.$transaction`) para marcar o desmarcar una franquicia, procesar un webhook y borrar una cuenta.
2. **Las restricciones van en la base**, no solo en el código: la PK de `mark` impide duplicados; `billing_event` impide procesar un evento dos veces.
3. **RLS activado sin políticas** en todas las tablas de `public`, y la Data API (PostgREST) de Supabase desactivada para ese esquema: el navegador no puede leer ni escribir directamente aunque obtenga la clave anónima (ADR-0028).
4. **Rol de mínimo privilegio para la API:** en tiempo de ejecución, la API usa un rol propio con solo `SELECT/INSERT/UPDATE/DELETE` sobre las tablas de `public`. Las migraciones usan el rol propietario solo desde CI.
5. Conexión en tiempo de ejecución por el **pooler de Supabase en modo transacción** (funciones sin estado, ADR-0021); las migraciones usan la conexión directa (ADR-0018).
6. Las migraciones son **compatibles hacia atrás** (primero se expande, después se contrae), para que el código anterior siga funcionando durante el despliegue (ADR-0027).
7. El catálogo no se guarda. Solo se guardan identificadores de AniList y MAL (RDI-13, RDI-20).

### Respaldos

La capa gratuita de Supabase no ofrece recuperación a un punto en el tiempo. Se agrega un **`pg_dump` semanal cifrado** con `age` desde GitHub Actions, subido a un **bucket privado de Cloudflare R2** (capa gratuita) con retención de 4 semanas. Como el repositorio es público, el respaldo nunca se guarda como artefacto de Actions. Al pasar a Supabase Pro se usan sus respaldos diarios.

## Consecuencias

- **Positivas:** integridad garantizada por la base; atomicidad para las reglas de franquicia y pago; costo cero; sin una segunda base que operar.
- **Negativas / riesgos:**
  - Como Prisma no aplica RLS, el aislamiento entre usuarios depende de que cada repositorio filtre por `user_id`. Se cubre con pruebas de integración de aislamiento (ADR-0029).
  - El respaldo con datos personales depende de un proveedor más (Cloudflare R2); va cifrado y con retención corta (ADR-0028).
- **Acciones derivadas:**
  - Crear el esquema Prisma con las tablas anteriores y la migración que activa RLS en todas ellas.
  - Crear el rol de ejecución de la API y desactivar la Data API para `public`.
  - Configurar el `pg_dump` semanal cifrado con `age`, el bucket privado de R2 con regla de expiración y la clave fuera del repositorio.
