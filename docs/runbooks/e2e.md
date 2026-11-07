# Pruebas E2E

Recorridos de Playwright contra la app construida en local, con Postgres desechable y Neon Auth y AniList simulados ([ADR-0037](../adrs/0037-e2e-contra-la-app-construida-en-ci.md)). En CI los corre el job **E2E** en cada PR.

## Correrlas en local

1. Un Postgres desechable, con las migraciones:

   ```sh
   docker run -d --rm --name acrux-e2e-db -p 54329:5432 -e POSTGRES_PASSWORD=postgres postgres:17
   export DATABASE_URL=postgresql://postgres:postgres@localhost:54329/postgres
   DATABASE_URL_UNPOOLED=$DATABASE_URL pnpm --filter @acrux/api db:deploy
   ```

2. Los navegadores, una sola vez: `pnpm --filter @acrux/e2e exec playwright install chromium webkit`.
3. Construir la API y la web para E2E: `pnpm --filter @acrux/e2e build:apps`. La web queda con `VITE_NEON_AUTH_URL=http://localhost:4173/neon-auth`; no la despliegues.
4. Correr: `pnpm --filter @acrux/e2e e2e`. Playwright levanta los tres servidores y los apaga al terminar. El informe queda en `apps/e2e/playwright-report` (`pnpm --filter @acrux/e2e exec playwright show-report`).
5. Al terminar: `docker stop acrux-e2e-db`.

Cada prueba crea su propio usuario, así que la base no se limpia entre corridas. Después de cambiar la API o la web, repite el paso 3.

## Qué se simula

| Pieza | Cómo |
|---|---|
| Neon Auth, en la API | `support/fake-neon-auth.ts` (puerto 4010) crea una clave al arrancar, publica `/neon-auth/.well-known/jwks.json` y firma los JWT de prueba (`sub` uuid, `name`, `exp` de una hora, emisor `http://localhost:4010`). La API lo usa como `NEON_AUTH_BASE_URL`. |
| Neon Auth, en el navegador | `support/neon-auth.ts` intercepta `/neon-auth/get-session` (devuelve la sesión con el JWT en `set-auth-jwt`) y `/neon-auth/sign-out`. |
| Borrado del usuario en Neon | `support/start-api.ts` levanta `apps/api/dist` y desvía las llamadas a `https://console.neon.tech/api/v2/` al servidor falso, que anota el usuario borrado. |
| AniList | `support/anilist.ts` responde `graphql.anilist.co` según la operación (`CatalogPage`, `FranchiseMedia`, `MediaByIds`, `Genres`) con datos fijos de «Sousou no Frieren» (dos temporadas). Las portadas son un PNG de 1 × 1. |
| Web Share | Se quita de `navigator`, así la tarjeta siempre se descarga (`@CA-RF31-02`). |
| Todo lo demás | Cualquier petición fuera de `localhost` se aborta. Sentry, PostHog y Upstash quedan apagados porque no tienen variables. |

No prueba la configuración de Vercel (rewrites, cabeceras, CSP) ni el Neon Auth real: eso queda para la prueba de humo del despliegue y la revisión de la vista previa.

## Agregar un recorrido

1. Elige los escenarios de `docs/criterios/*.feature` que prueba y empieza el título de la prueba con sus etiquetas: `test('@CA-RF20-01 …', …)`. Así `pnpm --filter @acrux/e2e check-tags` los cuenta.
2. Crea `apps/e2e/tests/<recorrido>.spec.ts` e importa `test` y `expect` de `../support/fixtures.ts`. Pide el fixture `signedIn` para tener sesión; `visitorContext(browser)` abre un navegador sin sesión.
3. Prepara el estado inicial con la API (`support/api.ts`) y recorre la pantalla con roles y textos en español, como los ve el usuario.
4. Si la pantalla pide a AniList algo que los datos fijos no tienen, agrégalo en `support/anilist.ts`.
