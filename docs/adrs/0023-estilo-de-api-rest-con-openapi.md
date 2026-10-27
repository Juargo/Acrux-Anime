# ADR-0023: Estilo de la API: REST con contrato OpenAPI, sin WebSocket

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Complementa ADR-0018 (Express, Zod 4 y `zod-openapi`).

## Contexto

La API propia (ADR-0018) atiende solo a la SPA: Acrux es únicamente web por ahora (ADR-0031). Sus operaciones son CRUD sencillas sobre recursos del usuario (perfil, marcas, plan y vínculo con AniList), una lectura pública (perfil público) y la recepción de webhooks de Lemon Squeezy. **Ninguna función necesita datos en tiempo real:** no hay chat, presencia ni edición colaborativa. El usuario ve sus propios cambios de inmediato gracias a la actualización optimista.

El catálogo no pasa por la API: el navegador consulta AniList (ADR-0024), que es GraphQL.

## Opciones consideradas

| Opción | Resultado | Motivo |
|---|---|---|
| **REST + OpenAPI** | **Elegida** | Encaja con recursos CRUD; cachea bien en el CDN (perfil público); el contrato OpenAPI ya está definido (ADR-0018) y habilita las pruebas de contrato (ADR-0029); los webhooks de Lemon Squeezy son REST de todos modos. |
| GraphQL propio | Descartada | Agrega un esquema y un servidor GraphQL que no aportan nada con tan pocos recursos. |
| WebSocket | Descartada | No hay casos de tiempo real; las conexiones persistentes no encajan con funciones serverless. Si apareciera un caso, Supabase Realtime está disponible sin otro servidor. |
| tRPC | Descartada | Con un solo cliente web sería viable, pero ADR-0018 ya fijó REST con OpenAPI; cambiarlo no aporta lo suficiente y tRPC no cachea bien en el CDN el perfil público. |

## Decisión

**API REST con JSON**, bajo `app.acruxanime.com/api` (ADR-0020), con el contrato OpenAPI 3.1 generado desde los esquemas Zod (ADR-0018).

### Recursos iniciales

| Método y ruta | Acceso | Uso |
|---|---|---|
| `GET /api/v1/me` | Usuario | Perfil, plan y modo del contador |
| `PATCH /api/v1/me` | Usuario | Nombre visible, avatar, idioma, visibilidad de la lista, modo del contador |
| `DELETE /api/v1/me` | Usuario | Borrado de cuenta (RF-06) |
| `GET /api/v1/me/export` | Usuario | Exportación de los datos personales en JSON (ADR-0028) |
| `GET /api/v1/me/marks` | Usuario | Marcas del usuario (ids y estado) |
| `PUT /api/v1/me/marks/{anilistId}` | Usuario | Marca una entrada como vista o viendo (idempotente) |
| `DELETE /api/v1/me/marks/{anilistId}` | Usuario | Desmarca una entrada |
| `POST /api/v1/me/marks:batch` | Usuario | Marca o desmarca todo el núcleo de una franquicia en una transacción (RDI-31) |
| `GET /api/v1/franchise-overrides` | Usuario | Correcciones del curador (RDI-15) |
| `GET /api/v1/profiles/{handle}` | **Público** | Perfil público; responde 404 si la lista es privada (RNF-31) |
| `POST /api/v1/anilist/link`, `DELETE /api/v1/anilist/link` | Usuario | Vincular y desvincular AniList (ADR-0025) |
| `POST /api/v1/billing/checkout` | Usuario | Crea el checkout de Lemon Squeezy |
| `POST /api/v1/webhooks/lemon-squeezy` | **Firma HMAC** | Eventos de pago |
| `GET /api/health` | Público | Verificación de disponibilidad |

### Convenciones

- **Versión en la ruta** (`/v1`): la SPA y la API se publican juntas (ADR-0020), pero una pestaña abierta o la PWA instalada pueden quedar con una versión anterior del cliente; los cambios incompatibles van en una versión nueva.
- **Errores en formato RFC 9457** (`application/problem+json`) con un `code` estable para la UI y la i18n.
- **Idempotencia:** `PUT` y `DELETE` son idempotentes por definición; los webhooks se deduplican por `event_id` (ADR-0022).
- **Validación de toda entrada y salida con Zod**; se rechazan los campos desconocidos.
- **Paginación por cursor** en las listas que puedan crecer (marcas).
- **Caché:** las respuestas de usuario llevan `Cache-Control: private, no-store`; el perfil público, `public, s-maxage` corto.
- Cada respuesta lleva un `X-Request-Id` que se registra en los logs (ADR-0030).

## Consecuencias

- **Positivas:** un contrato simple, versionado y verificable en CI; sin servidores con estado.
- **Negativas / riesgos:** si algún día se necesita tiempo real, habrá que sumar Supabase Realtime o un servicio aparte.
- **Acciones derivadas:** definir los esquemas Zod de estos recursos en `packages/shared` y emitir el contrato OpenAPI.

