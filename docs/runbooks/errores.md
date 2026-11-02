# Seguimiento de errores con Sentry

La SPA y la API envían a Sentry los errores inesperados (ADR-0030). Los errores previstos de la API, como un 404 o un `ProblemError`, no se envían, y tampoco los fallos causados por el cliente, como un cuerpo demasiado grande, aunque hoy respondan 500. Sin `SENTRY_DSN` ni `VITE_SENTRY_DSN`, ningún SDK envía nada, como en desarrollo local.

## Qué se envía

- **API:** cada respuesta 500, repetida o no, con la etiqueta `requestId`, que coincide con `X-Request-Id` y con los logs. El evento se envía antes de responder, porque Vercel congela la función al terminar, con una espera máxima de 2 segundos; si no llega a tiempo, el log registra `error report failed`.
- **SPA:** errores no controlados y errores de React. Todavía no llevan `requestId`, porque la SPA aún no tiene cliente de API. Los errores repetidos seguidos se agrupan.
- **Además:** el SDK suma conteos anónimos de sesiones de la API y de eventos descartados, sin datos personales.
- **Nunca:** usuario, cookies, cabeceras, cuerpos, parámetros de URL ni migas de pan. El SDK 11 reemplazó `sendDefaultPii` por `dataCollection`, que **recolecta todo por defecto**, así que cada opción se apaga de forma explícita. `beforeSend` borra además la petición, `extra`, que guarda enteros los objetos lanzados, y `transaction`, que guarda la ruta cruda. También reemplaza correos, JWT, cabeceras `Bearer` y URL de Postgres en los mensajes; otros formatos pasan tal cual, así que un mensaje de error nunca debe incluir datos sensibles.

## Configuración inicial

1. Crear la cuenta en sentry.io con el plan Developer y la **región de datos de la UE**. La región no se puede cambiar después.
2. Aceptar el acuerdo de tratamiento de datos (ADR-0028).
3. Crear un proyecto `acrux-anime` para las dos aplicaciones y copiar su DSN.
4. En el proyecto, activar la opción que evita guardar direcciones IP y el depurador de datos del servidor.
5. Comprobar que exista una regla de alerta que envíe un correo cuando aparece un problema nuevo.
6. En el proyecto `app` de Vercel, para *Production* y *Preview*, crear `SENTRY_DSN` y `VITE_SENTRY_DSN` con el DSN. No es un secreto: viaja en el código de la SPA.
7. Crear un token de organización con los permisos `project:releases` y `org:read`.
8. En el entorno de GitHub `deploy-production`, crear el secreto `SENTRY_AUTH_TOKEN` y las variables `SENTRY_ORG` y `SENTRY_PROJECT`.

## Source maps

El paso `Build` de `deploy.yml` compila la SPA con esas tres variables. Vite genera los mapas, los sube a Sentry y los borra antes de publicar. Sin esas variables no se generan mapas, como en las vistas previas: ahí el error llega con el código minificado.

Si la subida falla, el despliegue continúa y sólo se pierden las trazas legibles de esa versión: hay que revisar el paso `Build`. La API no sube mapas porque `tsc` no minifica.

## Probar en una vista previa

Crear una rama que **no se fusione**, con una ruta pública que lance un error, abrirla en la vista previa y comprobar que el evento aparezca en Sentry con el mismo `requestId` de la respuesta y sin datos personales. Después, cerrar la rama.

## Cuota

Los errores repetidos consumen cuota, porque cada `requestId` debe llegar. El plan Developer incluye 5.000 errores al mes y un usuario. Si se acaba, Sentry descarta los eventos hasta el mes siguiente; los errores de la API siguen en los logs de Vercel.
