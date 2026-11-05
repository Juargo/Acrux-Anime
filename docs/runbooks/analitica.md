# Analítica de producto con PostHog

La web app envía a PostHog (nube de la UE) los eventos de ADR-0030 solo después de que el usuario acepta el aviso de consentimiento, igual que la landing (#46). Sin `VITE_POSTHOG_KEY` el aviso no aparece y no se carga nada; sin `ANALYTICS_ID_SECRET` la app envía eventos anónimos, sin identificar a la persona.

## Qué se envía

| Evento | Cuándo | Propiedades |
|---|---|---|
| `signup_completed` | La primera vez que el usuario acepta en un dispositivo, con la fecha de alta del perfil | ninguna |
| `franchise_marked` | Marca o desmarca una franquicia desde el catálogo o el detalle | `status`, `coreSize` |
| `counter_mode_changed` | Cambia cómo cuenta el contador | `mode` |
| `card_generated` | Se crea la imagen de la tarjeta | `mode`, `covers` |
| `card_shared` | Comparte o descarga la tarjeta | `method` |
| `list_made_public` | Hace pública la lista | `source` |
| `public_profile_viewed` | Alguien abre un perfil público | `listVisibility` |
| `anilist_rate_limited` | AniList responde 429 | `attempt` |
| `$pageview`, `$web_vitals` | Cada pantalla; LCP, INP y CLS | los de PostHog |

- **Sin datos personales:** ni correo, ni nombre, ni handle, ni textos de búsqueda. Antes de salir del dispositivo, cada evento (también los del SDK) pierde `title`, que en un perfil público lleva el nombre, y toda URL o ruta `/@handle` pasa a `/@:handle`.
- **Identidad:** PostHog conoce a cada persona por `analyticsId`, un HMAC-SHA256 del `user_id` con `ANALYTICS_ID_SECRET` (32 caracteres) que entrega `GET /api/v1/me`. Nunca ve el `user_id`.
- **Sin captura automática:** nada de clics, campos de texto, mapas de calor, grabaciones, encuestas, experimentos, *feature flags* ni código remoto. Las Web Vitals se cargan desde el propio bundle.
- **Retirar el consentimiento:** se puede en Perfil → «Analítica». La app olvida a la persona (`reset`), deja de capturar (`opt_out_capturing`, siempre después de `reset`, que borra el opt-out) y borra lo que PostHog guardó (`ph_*`).
- **Cerrar sesión:** olvida a la persona (`reset`) y conserva el consentimiento; la siguiente cuenta en el dispositivo es otra persona.
- **Pendientes:** llegan con sus issues `anilist_linked`, `plus_checkout_started`, `plus_purchased`, `account_deleted` y el borrado de la persona en PostHog. `waitlist_joined` sigue en la landing.

## Configuración inicial

1. En PostHog (nube de la UE), usar el mismo proyecto de la landing y copiar su *Project API key* (empieza con `phc_`). No es un secreto: viaja en el código de la SPA. En *Project settings*, activar «Discard client IP data».
2. En el proyecto `app` de Vercel, para *Production* y *Preview*:
   - `VITE_POSTHOG_KEY`: la clave del paso 1.
   - `ANALYTICS_ID_SECRET`: un secreto de al menos 32 caracteres, por ejemplo la salida de `openssl rand -hex 32`, marcado como *Sensitive*.
   - **No cambiar `ANALYTICS_ID_SECRET` después de la beta:** cada persona pasaría a contarse como otra y se romperían la retención y la activación.
3. Volver a desplegar las vistas previas o producción para que tomen las variables.

## Tablero «Beta Acrux» (ADR-0030, RN-M1 a RN-M3)

Crear en PostHog un tablero con estos *insights*. La vista previa y producción comparten proyecto: filtrar por `$host` (`app.acruxanime.com` o el dominio de la vista previa) para separarlas.

| Insight | Tipo | Definición |
|---|---|---|
| Tarjetas compartidas por semana (North Star) | Trends | `card_shared`, total, intervalo semanal |
| Activación (RN-M1) | Funnel | `signup_completed` → `card_shared`, ventana de conversión de 30 días (quien acepta tarde conserva su fecha de alta), métrica «tiempo hasta convertir» (mediana; meta < 3 min) |
| Tasa de compartir (RN-M2) | Trends con fórmula | A = usuarios únicos con `card_shared`; B = usuarios únicos con la acción «Uso activo»; fórmula `A / B`, semanal; filtro «personas identificadas» |
| Retención D7 y D30 (RN-M3) | Retention | Evento inicial `signup_completed`; evento de regreso la acción «Vuelve a marcar o compartir»; intervalos diarios; leer los días 7 y 30 |
| Visitas a perfiles públicos | Trends con fórmula | `public_profile_viewed` / `card_shared`, semanal |
| Core Web Vitals en móvil (RNF-10) | Web analytics → Web vitals | Filtro `$device_type = Mobile`; metas LCP < 2,5 s, INP < 200 ms, CLS < 0,1 (p75) |
| Límite de AniList | Trends | `anilist_rate_limited`, total diario |

Antes, crear dos acciones en PostHog (*Data management → Actions*):

- **Uso activo:** cualquiera de `franchise_marked`, `counter_mode_changed`, `card_generated` o `card_shared`.
- **Vuelve a marcar o compartir:** `franchise_marked` o `card_shared`.

Los KPI solo cuentan a quienes aceptaron el aviso (ADR-0030). `signup_completed` se envía una vez por dispositivo, con la misma fecha de alta; los *insights* cuentan personas, así que un segundo dispositivo no duplica a nadie.

## Monitor externo de `/api/health` (RNF-22)

1. En UptimeRobot (plan gratuito), crear un monitor «Keyword» contra `https://app.acruxanime.com/api/health`, con la palabra `ok`, cada 5 minutos.
2. Alerta por correo al stakeholder, después de 2 fallos seguidos.
3. La meta es ≥ 99,5 % mensual; la página de estado del monitor muestra la disponibilidad de los últimos 30 días.

## Comprobación (criterio de #46)

1. Con las variables configuradas en *Preview*, abrir la vista previa de un PR, aceptar el aviso, marcar una franquicia y compartir una tarjeta.
2. En PostHog → *Activity*, ver `signup_completed`, `franchise_marked`, `card_generated` y `card_shared` con el `$host` de la vista previa, la persona identificada con su `analyticsId` y ninguna propiedad personal.
3. Rechazar desde Perfil → «Analítica»: el siguiente evento ya no llega y desaparecen las claves `ph_*` de `localStorage`.
4. El tablero muestra esos eventos al filtrar por el `$host` de la vista previa.
