# Catálogo propio con datos de MyAnimeList (ADR-0043)

Objetivo: reemplazar AniList por MyAnimeList como fuente de datos, con un catálogo propio en Neon servido por la API. Rama `feat/catalogo-myanimelist`. Entrega: `ask-on-risk`, cadena `feature-branch-chain`: cada PR hijo apunta a esta rama y `main` recibe un solo merge al final. Runner: Vitest (`pnpm --filter @acrux/web test`, `pnpm --filter @acrux/api test`, `pnpm --filter @acrux/domain test`).

## Specs

- **S1.** Pedido del stakeholder: «Migremos a Myanimelist». Contexto del mismo día: «Voy a dejar los anuncios para más adelante. Quiero comenzar con el lanzamiento directo de la app.»
- **S2.** Decisión del stakeholder: respondió «si» a «¿Vamos con el catálogo propio (A)?». Opción A, tal como se le presentó: «Un job programado en GitHub Actions copia los animes más populares con sus relaciones, y el resto se completa cuando alguien lo busca. El catálogo, los filtros y el agrupamiento se sirven desde nuestra base.»
- **S3.** La app conserva lo que hoy hace con AniList: catálogo con búsqueda y filtros por género, formato y año; detalle de franquicia; marcar franquicias; contador; Mi lista; tarjeta para compartir; perfil público; estadísticas; insignias; pantalla del curador.
- **S4.** El navegador no llama a MyAnimeList ni recibe el client ID (ADR-0043, punto 1).
- **S5.** El ID de MyAnimeList reemplaza al de AniList en las marcas, la tabla del curador, las rutas y los contratos de la API. Ninguna marca ni override guardado se pierde en silencio: lo que no se pueda convertir se exporta y se informa (ADR-0043, punto 6).
- **S6.** Las pantallas con datos del catálogo dan crédito a MyAnimeList con un enlace. Condición del soporte de MyAnimeList: «We kindly request that you credit MyAnimeList wherever our data is used, referred to, or published.»
- **S7.** El trabajo de carga no sobrecarga a MyAnimeList. Condición del soporte: «Please note that access may be restricted if request counts become excessive and impose a burden on our system.»
- **S8.** La documentación refleja el cambio: requisitos (RES-20, RES-21, RES-25, R-01, R-05, RF-02 a RF-04), deuda técnica, runbooks, textos legales de la landing y política de seguridad de contenido.

Supuestos, no pedidos por el stakeholder:

- La vinculación con AniList (#40, #41) sale del alcance.
- Los enlaces guardados a `franquicia/:anilistId` dejan de servir.

## Tasks

Pronóstico: más de 3.000 líneas cambiadas, muy por encima de 400. T5 y T6 deben llegar a producción juntas: la web no puede leer de MyAnimeList con marcas guardadas por ID de AniList.

| ID | Qué | Specs | Ruta | Rama hija | Estado | Commit |
|---|---|---|---|---|---|---|
| T1 | ADR-0043 y este documento | S1, S2 | inline | (rama de integración) | hecho | fcbc943 |
| T2 | API: tabla de catálogo y módulo de catálogo (catálogo con filtros, animes por ID, franquicia, géneros), servidos desde Neon | S2, S3, S4 | inline | `feat/catalogo-myanimelist-01-api` | hecho | d94c27b, 419a8ab |
| T6a | Nombre neutral del ID: `anilistId` pasa a `animeId` en la API, la web, el dominio y las columnas; los valores no cambian (riesgo ítems 1 y 3) | S5 | inline | `feat/catalogo-myanimelist-02-id-neutral` | hecho; verificador sin bloqueos | 513914c |
| T3 | Cliente de MyAnimeList en la API, conversión a la tabla, carga por demanda de lo que falta y CSP para las portadas | S2, S4, S7 | inline | `feat/catalogo-myanimelist-07-fuente` | hecho | c84c17c |
| T4 | Trabajo programado de carga y refresco, con su rol de base de datos (riesgo ítems 1, 2 y 5) | S2, S7 | inline | `feat/catalogo-myanimelist-07-fuente` | hecho; falta la puesta en marcha en producción | (este commit) |
| T5 | Web: cliente del catálogo en lugar del de AniList, mensajes de error, simulación en E2E | S3, S4 | delegada (contexto) | `feat/catalogo-myanimelist-03-web` | hecho | b915149, b9da917 |
| T6b | Los IDs guardados pasan a ser de MyAnimeList, junto con el cambio de fuente de la web (riesgo ítem 1) | S5 | inline | `feat/catalogo-myanimelist-04-ids-mal` | hecho; verificador sin bloqueos abiertos | d2f1eba, 4271c3f |
| T7 | Crédito en «Acerca de» y en la landing, textos del curador, textos legales y documentación. La CSP pasó a T3 (L17) | S6, S8 | delegada (contexto) | `feat/catalogo-myanimelist-05-credito` | hecho | (este commit y el anterior) |
| T8 | Verificador independiente (T4 y T6) y vista previa | S1–S8 | verificador | — | pendiente | — |

## Log

- **L1 (2026-11-10):** «Voy a dejar los anuncios para más adelante. Quiero comenzar con el lanzamiento directo de la app. Que quedaría por hacer para que lo que hay esté listo para producción?»
- **L2 (2026-11-10):** «Migremos a Myanimelist».
- **L3 (2026-11-10):** «si», a la pregunta «¿Vamos con el catálogo propio (A)?».
- **L4:** Evidencia previa al diseño:
  - Mapa del código: el cliente de AniList vive en `apps/web/src/anilist/`; el agrupamiento, en `packages/domain/src/franchise/grouping.ts`; 12 pantallas y hooks reciben un `AniListClient`; `mark` tiene la clave `(user_id, anilist_id)` y `mal_id` puede ser nulo; `franchise_override` solo guarda IDs de AniList.
  - API de MyAnimeList: sin CORS (probado con `curl`, sin client ID); la referencia oficial no se pudo leer; los campos vienen de clientes de la comunidad y están sin confirmar.
  - No se sabe cuántas marcas de producción tienen `mal_id` nulo.
- **L5:** El lanzamiento directo se salta los umbrales de H1 y la beta de H2 (ADR-0031). Esa decisión necesita su propio ADR y queda fuera de este documento.
- **L6 (2026-11-10):** «si», a la pregunta «¿Encadeno los PRs sobre una rama de integración?».
- **L7:** Cambio de plan después de leer el código:
  - Se quitó la tarea «dominio sin nombres de AniList» como tarea aparte. El vocabulario de relaciones y formatos de `@acrux/domain` ya alcanza para los valores de MyAnimeList. Renombrar `anilistId` toca 380 referencias en la web y en la API, y solo tiene sentido junto con el cambio de contratos (T6).
  - La tabla y el módulo de catálogo (T2) no dependen de la forma de las respuestas de MyAnimeList, así que van primero. El client ID solo bloquea T3 y T4.
  - Ruta de T2: inline; es una sola unidad y no hay otra independiente para lanzar en paralelo.
- **L8:** T2 hecha en `feat/catalogo-myanimelist-01-api`:
  - `d94c27b`: tabla `anime` (migración `20261110000000_catalogo`, con RLS y permisos para `acrux_api`) y repositorio.
  - `419a8ab`: servicio y módulo `catalog` con cuatro rutas públicas y cacheables: `GET /api/v1/catalog/anime`, `/anime/by-ids`, `/franchises` y `/genres`.
  - RED observado antes de implementar: 20 tests fallando en 3 archivos. Después: API con 381 tests en 29 archivos, typecheck, `openapi:check`, depcruise y `biome ci` pasan. Las pruebas del repositorio corren contra Postgres 17 con las migraciones reales.
  - La búsqueda ordena por popularidad, no por parecido con el nombre como hacía AniList.
  - La tabla todavía está vacía: la llenan T3 y T4.
  - Revisión nativa: apagada (`gentle-ai review mode status`: off, global).
  - Riesgo: ninguno. Tabla nueva y rutas nuevas; no cambia datos ni contratos existentes.
- **L9:** Orden revisado: conviene hacer la parte de API de T6 (clave y contratos) antes que la web (T5), para que la web cambie de fuente y de nombres una sola vez. T6 necesita saber qué hay guardado en producción.
- **L10 (2026-11-10):** «si», a «¿Me autorizás a consultar producción en solo lectura?». El stakeholder instaló y conectó el plugin de Neon. Consulta de conteos sobre la rama `production` del proyecto `Acrux-Anime`: 1 usuario, 0 marcas, 0 filas del curador. No hay datos que convertir en producción. La rama `dev` no se consultó.
- **L11:** T6 se partió en dos:
  - **T6a**, solo nombres: `anilistId` → `animeId` en contratos, rutas, códigos de error (`invalid_anime_id`), exportación de la cuenta, dominio y web; migración `20261110010000_id_de_anime` que renombra las columnas `anilist_id` de `mark` y `franchise_override`. Los valores siguen siendo IDs de AniList hasta T6b. 58 archivos, renombre mecánico.
  - **T6b**, el cambio de significado, va junto con la web (T5).
  - Sin RED previo: es un renombre; las suites existentes son la red de seguridad. Después del cambio: typecheck de todo el repo; tests de API 381, web 389, dominio 45, landing 26, e2e (unitarios) 5; `biome ci` sin errores; `openapi:check` al día. Los E2E con navegador no se corrieron en local.
  - Riesgo: ítem 3 (cambian nombres de campos, rutas y códigos de error de la API, pedido por la migración) e ítem 1 (renombre de columnas con datos). Corresponde verificador independiente.
- **L12:** Verificador independiente de T6a sobre `513914c` contra `438e6a2`, en una copia aparte: S5 pasa en lo que cubre T6a, sin bloqueos.
  - Datos: con filas en `mark` y `franchise_override`, el hash y la cantidad de filas son iguales antes y después de la migración; clave primaria, RLS, permisos y política intactos; `prisma migrate diff` sin diferencias.
  - El diff normalizado solo contiene el renombre, la migración nueva y tres reacomodos de formato. Las consultas a AniList, `anilist_link` y los eventos no cambiaron.
  - No comparó respuestas HTTP en vivo entre las dos versiones; se apoyó en la suite de la API.
  - Aviso: queda la constante local `ANILIST_ID` en `apps/web/src/curator/CuratorScreen.tsx:17`; se revisa en T5.
  - Comprobación del orquestador: la búsqueda de nombres viejos solo devuelve esa constante.
- **L13:** Ruta de T5: delegada a un escritor, por contexto (sesión larga). T5 cubre solo la web, los E2E y los textos de la web. La baja de `mal_id` en la API y la conversión de IDs guardados quedan como T6b, inline, después.
- **L14:** T5 (escritor delegado), commits `b915149` (web e i18n) y `b9da917` (E2E):
  - Módulo nuevo `apps/web/src/catalog-source/`; se borró `apps/web/src/anilist/` y `apps/e2e/support/anilist.ts`. El diff quedó dentro de la superficie autorizada (70 archivos, 1.952 líneas agregadas y 733 quitadas).
  - RED: los cinco archivos de test del cliente nuevo fallaron antes de existir sus módulos. Después: web 391 tests, typecheck del repo, `biome ci` sin errores.
  - Comprobación del orquestador: repetí `pnpm --filter @acrux/web test` (391) y `pnpm -r typecheck`.
  - `gentle-ai review assess`: riesgo medio, `review_due: false`. Revisión nativa apagada.
  - E2E con navegador en una copia aparte sobre `b9da917`: 18 de 18 (9 en Chromium, 9 en WebKit).
  - Cambios que nota un usuario: la búsqueda ordena por popularidad; un 429 de la API muestra el error sin reintentar (antes el cliente esperaba el límite de AniList); los extras de una franquicia muestran su cantidad de episodios; ya no existe el evento `anilist_rate_limited`.
  - Riesgo: ninguno de la lista. No está probado con datos reales: la tabla de catálogo sigue vacía hasta T3.
  - Fuera de la superficie, para T7: CSP de `apps/web/vercel.json`, CORS del servidor de portadas para la tarjeta, `docs/runbooks/analitica.md` todavía nombra `anilist_rate_limited`, textos del curador que dicen «ID de AniList».
- **L15:** T6b, inline:
  - Migración `20261110020000_ids_de_myanimelist`: `mark.anime_id` pasa a valer el `mal_id` y la columna `mal_id` se elimina. Lo que no se puede convertir no se borra: las marcas sin `mal_id` y las duplicadas van a `mark_anilist` con el motivo, y la tabla del curador completa va a `franchise_override_anilist`. Las dos tablas tienen RLS, sin permisos para `acrux_api`; `mark_anilist` se borra con la cuenta.
  - Contrato: `malId` sale de las marcas, del lote, del perfil público y de la exportación de la cuenta. Un cuerpo con `malId` ahora recibe 400.
  - RED: los tres casos nuevos de contrato devolvían 200 y la prueba de conversión fallaba por falta de la migración. Después: API 388 tests en 29 archivos, web 391, typecheck, `openapi:check`, depcruise y `biome ci` sin errores.
  - La prueba de conversión corre los archivos de migración uno por uno sobre una base aparte, con IDs cruzados, duplicados y marcas sin `mal_id`.
  - Riesgo: ítem 1 (modifica y mueve datos guardados) e ítem 3 (quita un campo del contrato). Corresponde verificador independiente.
- **L16:** Verificador independiente de T6b sobre `d2f1eba` contra `b9da917`, en una copia aparte:
  - Conservación: 4.023 marcas de 60 usuarios (intercambios, ciclo de 3, duplicados con empates, marcas sin `mal_id`) y 3 overrides. Resultado: 3.378 en `mark` más 645 en `mark_anilist`, ninguna perdida, duplicada ni alterada; los 3 overrides, intactos en `franchise_override_anilist`.
  - Esquema: clave `(user_id, anime_id)`, RLS en las 10 tablas, `acrux_api` sin acceso a las tablas nuevas, `acrux_backup` las lee, borrado en cascada, `prisma migrate diff` sin diferencias.
  - Mutó la migración cinco veces y la prueba de conversión detectó las cinco.
  - **Bloqueo B1:** Prisma no envuelve la migración en una transacción; con un fallo a mitad, las marcas quedaban a medio convertir. Corregido en `4271c3f` con `BEGIN … COMMIT`.
  - Recomprobación de B1 sobre `4271c3f`: con un error inyectado antes del `COMMIT` no se aplica nada; sin el error, la conversión conserva todo y `_prisma_migrations` la registra como terminada; `migrations.test.ts` 37 de 37. Bloqueo cerrado.
  - No hizo comparación pedido por pedido de las rutas contra la versión anterior ni pruebas HTTP en vivo; se apoyó en las suites.
  - Avisos sin corregir: la exportación de la cuenta no incluye `mark_anilist`; entre duplicados gana la marca «vista» aunque la «viendo» sea más antigua.
- **L17:** La CSP (`apps/web/vercel.json`) no se toca en T7: el PR #109 la mueve a `apps/web/api/_csp.ts` y todavía no está en `main`, y el servidor de portadas de MyAnimeList está sin confirmar. Pasa a T3.
- **L18:** T7 (escritor delegado), dentro de la superficie autorizada (35 archivos):
  - Crédito a MyAnimeList con enlace en «Acerca de», en el pie de la landing y en la sección legal «Catálogo y MyAnimeList». No se quitó ni agregó ninguna afirmación legal; solo cambió la fuente.
  - Textos del curador en los dos idiomas. Se quitó de la pantalla de borrado la línea «No se toca: tu lista de AniList.».
  - Documentación: requisitos 01 a 06, 7 criterios, 7 runbooks y deuda técnica. Las etiquetas `@CA-` son las mismas 73 antes y después.
  - RED: 6 tests de la web fallaron al cambiar primero las expectativas. `credit.test.ts` de la landing se escribió después del código, sin RED.
  - Después: web 391, landing 31, e2e (unitarios) 10, typecheck, `biome ci` sin errores. Comprobación del orquestador: repetí web y landing.
  - El orquestador quitó el selector `.delete-account__kept` de `apps/web/src/styles.css`, que quedó sin uso.
  - Riesgo: ninguno.
  - **S6 queda parcial:** solo «Acerca de» y la landing dan crédito. Catálogo, detalle de franquicia, Mi lista, perfil público, tarjeta, estadísticas e insignias muestran datos del catálogo sin crédito. Agregarlo es una decisión de diseño del stakeholder.
  - Para el stakeholder: `@CA-RF28-03` (deshacer una escritura pendiente en AniList) solo tiene sentido con el vínculo de AniList; quedó marcado como fuera de alcance. En `RF-06.feature`, «mis marcas y mi enlace con AniList» pasó a «mis marcas». Además de los pedidos, se reescribieron RES-22, RES-23, RES-24, RES-31, R-02 y R-07, con nota fechada.
- **L19 (2026-11-10):** «si», a «¿Agrego una línea "Datos de MyAnimeList" con enlace al pie de esas pantallas?». Inline, en la rama de T7:
  - Componente `DataCredit` (`apps/web/src/components/DataCredit.tsx`), texto `app.dataCredit` («Datos de» / «Data from») y enlace a `https://myanimelist.net`, al pie de catálogo, detalle de franquicia, Mi lista, perfil público, tarjeta (la pantalla, no la imagen), estadísticas e insignias. «Acerca de» usa la misma constante `MAL_URL`.
  - RED: una prueba por pantalla, las 7 fallaron con «Unable to find role="link" and name "MyAnimeList"». GREEN: web 398, typecheck, `biome ci` sin errores.
  - **S6 queda cubierta** en las pantallas de la app. La imagen de la tarjeta que se comparte no lleva crédito: cambiarla es otra decisión de diseño.
  - Riesgo: ninguno.
- **L20 (2026-11-10):** «ok», a «¿Escribo el ADR del lanzamiento directo?». ADR-0044 en la rama `feat/catalogo-myanimelist-06-lanzamiento`, fuera de las specs de esta feature: modifica las condiciones de H1 y H2 de ADR-0031, y actualiza RN-04, la tabla de hitos y RES-02. Deja tres puntos por decidir: Plus en el lanzamiento, registro abierto y lista de espera. Solo documentación; riesgo: ninguno.
- **L21 (2026-11-10):** «Cualquier cobro apagado por ahora», a «¿Plus sale con el cobro activo en el lanzamiento, o lo lanzamos apagado?». ADR-0044 punto 3: Plus se lanza sin facturación (variables `LEMON_SQUEEZY_*` sin configurar en producción). Solo documentación.
- **L22 (2026-11-10):** «si», a «¿El registro queda abierto a cualquiera desde el primer día?». ADR-0044 punto 4. Solo documentación.
- **L23 (2026-11-11):** «si», a «¿Cambio ese botón de la landing para que lleve directo a la app, y dejamos la lista de espera sin uso?». En la rama `-06-lanzamiento`: los dos botones de la landing son «Abrir Acrux» / «Open Acrux» con enlace a `https://app.acruxanime.com` (`APP_URL`); se quitó `WaitlistForm.astro` y su texto; el chip pasó de «Beta cerrada · gratis» a «Gratis». RED: `apps/landing/src/cta.test.ts`, 4 fallas. GREEN: landing 35, typecheck y build. No se tocaron los textos legales, `/api/waitlist` ni Buttondown (ADR-0044, pendientes). Riesgo: ninguno.
- **L24 (2026-11-11):** «si», a «¿Actualizo los textos legales para sacar las menciones a la beta y a la lista de espera?». Hecho en los términos (es y en): salió «durante la beta» y «Está en beta», quedó «La app puede cambiar o fallar.», fecha 11 de noviembre de 2026. RED: 2 fallas en `cta.test.ts`; GREEN: landing 37. **No se tocó privacidad ni soporte:** describen el tratamiento de los correos de la lista de espera, que siguen guardados; quitar esas frases dejaría la política incompleta. Falta la decisión del stakeholder sobre esos correos.
- **L25 (2026-11-11):** «No alcancé a tener correos en lista de espera. Solo estpa la configuración de Buttondown pero ya non la usaré». No se pudo comprobar en Buttondown (sin acceso); coincide con la nota del 2026-10-30 de ADR-0031 (lista sin clave). En la rama `-06-lanzamiento`:
  - Privacidad y soporte (es y en) ya no nombran la beta, la lista de espera ni Buttondown; fecha 11 de noviembre de 2026. Upstash sigue nombrado: lo usa la API.
  - Se quitaron `/api/waitlist`, `lib/waitlist.ts`, `lib/rate-limit.ts` con sus pruebas, el evento `waitlist_joined`, las variables `BUTTONDOWN_API_KEY` y `UPSTASH_REDIS_REST_*` del esquema de Astro y la dependencia `@upstash/redis` de la landing. El adaptador de Vercel no se tocó.
  - ADR-0033 retirado; RDI-08, RDI-19 y los runbooks de analítica y de límite de peticiones actualizados.
  - RED: 3 fallas en `cta.test.ts`. GREEN: landing 22 (salieron las pruebas de lo retirado), typecheck, build y `biome ci`.
  - Riesgo: ítem 5 (dependencia y variables de entorno de la landing). El lockfile solo cambia la resolución de pares, sin subir versiones.
- **L26 (2026-11-11):** «[valor omitido] Este es el client id». El stakeholder pasó el client ID de MyAnimeList por el chat; el valor no se guarda en el repositorio ni en la memoria, y se usó desde un archivo fuera del repo. T3 y T4, inline, rama `feat/catalogo-myanimelist-07-fuente`:
  - Comprobado contra la API real: forma de los campos, `related_anime` solo en el detalle, ranking de unos 31.000 animes de a 500, valores de formato y relación, hentai marcado como `gray` con clasificación `rx`, y CORS abierto en `cdn.myanimelist.net`. Quedó escrito en ADR-0043.
  - T3 (`c84c17c`): adaptador `adapters/myanimelist.ts`, escritura en el repositorio (`CatalogStore`), carga por demanda en el servicio (hasta 8 detalles por pedido, el resto `pending`; búsqueda en la fuente solo si la tabla no tiene resultados; pausa de 5 minutos tras 403 o 429), `MAL_CLIENT_ID` en la configuración y CSP con `cdn.myanimelist.net`. Al guardar un detalle, los animes a los que apunta y que no apuntan de vuelta quedan para releer.
  - T4: `services/catalog-loader.ts`, `scripts/load-catalog.ts`, workflow `catalog.yml` (martes 07:00 UTC, 6.000 detalles) y migración `20261111000000_rol_de_catalogo` con el rol `acrux_catalog`, que solo llega a la tabla `anime`.
  - Las pruebas del adaptador, del servicio y del cargador se escribieron junto con el código, sin ver el RED por separado. El rol de base de datos sí: falló con «role "acrux_catalog" does not exist» antes de la migración.
  - Prueba real en un Postgres local desechable, con el rol `acrux_catalog`: 30.758 animes en 2 min 49 s y 40 detalles. Con la API levantada sobre esa base: búsqueda, catálogo por año, franquicia de Frieren (3 entradas y 3 relacionadas), Kimetsu no Yaiba 9 entradas en 1,5 s la primera vez y 13 ms la segunda; un ID de adultos y uno inexistente vuelven como `missing`.
  - Riesgo: ítems 1 (escritura en la tabla del catálogo), 2 (rol y secreto nuevos) y 5 (workflow nuevo). Queda para el verificador de T8.
  - Hallazgo para el stakeholder: MyAnimeList entrega 77 géneros (géneros, temas y demografías mezclados).
- **L27 (2026-11-11):** «si», a la pregunta «¿Dejo el filtro y las estadísticas solo con esos géneros?».
  - El conversor guarda solo los géneros de MyAnimeList más Ecchi (19 valores); los temas, las demografías y los géneros eróticos no se guardan. Un título con el género Hentai sigue marcado como adulto.
  - Con eso el filtro, los géneros favoritos y las insignias por géneros usan la misma lista. Traducciones: se agregaron las 6 que faltaban y salieron las 5 que ya no aparecen.
  - RED: 2 fallas en `myanimelist.test.ts`. GREEN: ver el commit.
  - Riesgo: ninguno. La tabla de producción todavía no tiene catálogo cargado.
