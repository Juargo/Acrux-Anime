# Límite de peticiones con Upstash

La API y la lista de espera de la landing cuentan las peticiones en Upstash Redis (ADR-0028, punto 6). Al superar el límite responden `429` con `Retry-After`, en segundos. Si falta `UPSTASH_REDIS_REST_URL` o `UPSTASH_REDIS_REST_TOKEN`, no se cuenta nada y no hay aviso, como en desarrollo local.

## Límites

| Dónde | Clave | Límite | Ventana |
|---|---|---|---|
| Rutas privadas con `rateLimit: 'write'` | usuario | 30 | 60 s |
| Rutas públicas con `rateLimit: 'public'` | IP | 60 | 60 s |
| `POST /api/waitlist` en la landing | IP | 5 | 10 min |

- **Rutas:** la API se protege por ruta, con `rateLimit` en su definición. Hoy no hay rutas de escritura ni de perfil público; se marcan al crearlas.
- **Algoritmo:** ventana fija, con un contador por clave y ventana creado y vencido en una sola transacción (`INCR` y `EXPIREAT`). Cerca del cambio de ventana se pueden aceptar hasta el doble de peticiones seguidas.
- **IP:** sale de `x-vercel-forwarded-for`, que Vercel sobrescribe.
- **Privacidad:** Upstash sólo recibe un hash SHA-256 de la IP o del usuario, que vence con su ventana. Un hash de una IP se puede revertir probando todas las direcciones; el vencimiento corto es lo que limita esa exposición.
- **Fallos:** si Upstash falla, responde algo inesperado o tarda más de un segundo, la consulta se corta y la petición pasa. La API registra `rate limit check failed` y la landing, `waitlist rate limit check failed`, en los logs de Vercel.

## Configuración inicial

1. Crear la cuenta en upstash.com, sin tarjeta.
2. Aceptar el acuerdo de tratamiento de datos de Upstash (ADR-0028).
3. Crear una base Redis en la región más cercana a São Paulo (`gru1`). Si existe `sa-east-1`, usar esa.
4. Copiar la URL REST y el token REST, no el de sólo lectura.
5. En Vercel, proyectos `app` y `landing`, crear `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, el token como secreto, para *Production* y *Preview*.
6. En el proyecto `landing`, la regla del firewall «Límite de la lista de espera» queda como respaldo con 20 cada 10 minutos. Con 5 respondía antes que Upstash, también en las vistas previas, y su `429` no trae `Retry-After`.

## Cuota

La capa gratuita incluye 500.000 comandos al mes. Cada control envía una transacción con dos comandos; no está verificado si Upstash cuenta también la apertura y el cierre de la transacción. Su página de precios no dice qué pasa al agotar la cuota gratuita: si rechaza los comandos, las peticiones pasan sin límite hasta el mes siguiente. Conviene revisar el consumo en su panel.

## Probar

Prueba del 2026-11-02 en una vista previa de la landing: los intentos 1 a 5 dieron `400` y el 6.º, `429` con `Retry-After: 435` y `{"status":"limited"}`.


En una vista previa, superar el límite de la lista de espera y comprobar el `429` con `Retry-After`. La API no tiene todavía rutas con límite: se prueba con la primera que lo use.
