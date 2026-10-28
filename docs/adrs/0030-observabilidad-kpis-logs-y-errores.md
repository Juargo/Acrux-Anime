# ADR-0030: Observabilidad: KPIs, logs y errores

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Métricas de éxito RN-M1 a RN-M4 y plan de validación de los Requisitos de Negocio y Usuario.

## Contexto

- **RN-04:** primero se valida la demanda. La landing y la beta necesitan medir los umbrales del plan de validación (por ejemplo, ≥15 % de registro en la lista de espera).
- **Métricas de éxito:** tiempo hasta la primera tarjeta compartida (< 3 min), tasa de compartir, retención D7 y D30, y conversión a Plus (2–5 %).
- Los disparadores de escala de ADR-0021 requieren indicadores técnicos.
- Presupuesto cercano a cero; privacidad con consentimiento (ADR-0028).

## Opciones consideradas

| Opción | Resultado | Motivo |
|---|---|---|
| **PostHog + Sentry** | **Elegida** | Embudos, retención, cohortes y banderas de funcionalidad en la capa gratuita de PostHog; errores con contexto en la capa gratuita de Sentry. |
| Umami + Sentry | Descartada | Umami mide visitas, pero no embudos ni retención por usuario. |
| Solo logs del hosting y SQL | Descartada | No mide el embudo de la landing ni la retención sin construir herramientas propias. |

## Decisión

### KPIs de producto

| KPI | Definición | Meta | Fuente |
|---|---|---|---|
| **Estrella polar: tarjetas compartidas por semana** | Eventos `card_shared` por semana | En aumento | PostHog |
| Registro en la lista de espera (validación) | `waitlist_joined` / visitantes únicos de la landing | ≥ 15 % | PostHog (landing) |
| Activación (RN-M1) | Mediana del tiempo entre `signup_completed` y el primer `card_shared` | < 3 min | PostHog (embudo) |
| Tasa de compartir (RN-M2) | Usuarios activos con `card_shared` / usuarios activos, por semana | Por definir tras la beta | PostHog |
| Retención D7 y D30 (RN-M3) | Usuarios que vuelven a marcar o a compartir 7 y 30 días después del registro | Por definir tras la beta | PostHog (retención) |
| Conversión a Plus (RN-M4) | `plus_purchased` / usuarios activos al mes | 2–5 % | PostHog + `entitlement` |
| Visitas a perfiles públicos | `public_profile_viewed` por perfil compartido | Indicador del motor viral | PostHog |

**Eventos del plan de medición:** `waitlist_joined`, `signup_completed`, `anilist_linked`, `franchise_marked`, `counter_mode_changed`, `card_generated`, `card_shared`, `list_made_public`, `public_profile_viewed`, `plus_checkout_started`, `plus_purchased`, `account_deleted`. Las propiedades nunca incluyen datos personales: ni correo, ni nombre, ni el texto de búsqueda.

### Indicadores técnicos (SLI)

| SLI | Objetivo inicial | Fuente |
|---|---|---|
| Disponibilidad de `/api/health` | ≥ 99,5 % mensual | Monitor externo gratuito |
| Latencia p95 de la API (escrituras de marcas) | < 300 ms | Logs (`durationMs`) |
| Tasa de errores 5xx | < 1 % | Logs + Sentry |
| Respuestas `429` de AniList por sesión | Cercana a 0 | Evento `anilist_rate_limited` |
| Core Web Vitals en móvil | LCP < 2,5 s; INP < 200 ms; CLS < 0,1 | PostHog (web vitals) |
| Almacenamiento de Postgres | < 80 % de la capa | Panel de Supabase (ADR-0021) |

Los objetivos son iniciales (RNF sin metas numéricas, decisión del 26-oct-2026) y se ajustan con los datos de la beta.

### Logs

- **`pino` con salida JSON** en la API. Campos: `time`, `level`, `requestId`, `route`, `method`, `status`, `durationMs` y `userIdHash` (hash del `user_id` con sal; nunca el id en claro).
- `X-Request-Id` se genera en cada petición, se devuelve al cliente y se adjunta a los errores de Sentry.
- **Nunca se registran:** tokens (Supabase, AniList), cabeceras `Authorization`, cuerpos de webhooks, correos ni nombres. Se aplica con la opción `redact` de `pino`.
- Niveles: `info` en producción, `debug` en desarrollo.
- Destino: logs de ejecución de Vercel, con retención corta en Hobby. Para guardar más tiempo se puede conectar más adelante un destino externo con capa gratuita.

### Errores

- **Sentry** en la SPA y en la API, con `sendDefaultPii: false`, depuración de datos sensibles y *source maps* subidos desde CI.
- Alertas por correo ante un problema nuevo o un aumento de la tasa de errores.

### Privacidad

- PostHog en su nube de la UE; sin cookies ni identificador persistente hasta el consentimiento; sin captura automática de campos de texto; grabación de sesiones desactivada (ADR-0028).
- Al borrar la cuenta se borra la persona en PostHog (`account_deleted` → API de PostHog).

## Consecuencias

- **Positivas:** los umbrales de validación y las métricas de éxito se miden desde el primer día, sin costo; errores rastreables de punta a punta con `requestId`.
- **Negativas / riesgos:**
  - Sin consentimiento no hay datos de esos usuarios: los KPIs se calculan sobre quienes aceptan.
  - La retención corta de los logs en Hobby limita la investigación de incidentes antiguos; Sentry conserva los errores.
- **Acciones derivadas:**
  - Implementar el plan de eventos en la landing y en la web app.
  - Configurar `pino` con `redact` y el *middleware* de `requestId`.
  - Configurar Sentry y la subida de *source maps* en CI (ADR-0027).
  - Tablero de PostHog con los KPIs anteriores y un monitor externo de `/api/health`.
