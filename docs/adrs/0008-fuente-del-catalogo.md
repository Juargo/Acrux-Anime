# ADR-0008: Fuente del catálogo: API oficial de MyAnimeList en vivo

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (S2, R5), Reunión 002 (implicaciones), Reunión 003 (D10, investigación), Reunión 005 (revisión), Sesión con el stakeholder, 2026-10-12

**Historial:** la propuesta anterior (D10) era sembrar el catálogo una sola vez desde anime-offline-database en Postgres. El stakeholder la descartó el 2026-10-12 a favor de consultar la API oficial de MyAnimeList en vivo.

## Contexto

La app gira en torno a una gran lista de animes marcables, con búsqueda por nombre y filtros por año, género y tipo (ADR-0009). Debe incluir todos los formatos: TV, película, OVA, ONA, especial (D6).

La Reunión 003 pidió un catálogo propio sembrado en Postgres. La sesión del 2026-10-12 cambió la decisión: **el proyecto no guarda ningún catálogo**. El usuario busca y filtra en la interfaz y la app consulta la API de MyAnimeList; al marcar un anime como visto, el sistema guarda solo el id de MAL asociado al usuario.

## Opciones consideradas

| Opción | Resultado | Motivo |
|---|---|---|
| **API oficial de MyAnimeList v2, en vivo** | **Elegida** | Fuente oficial y siempre al día; permite uso no comercial; no requiere sembrar ni almacenar el catálogo |
| Jikan en vivo | Descartada | API no oficial basada en scraping; el [acuerdo de MAL](https://myanimelist.net/static/apiagreement.html) (§4(i)) prohíbe obtener contenido por otro medio que no sea directamente la API |
| anime-offline-database sembrada | Descartada | Decisión del stakeholder; además, la licencia ODbL implica obligaciones de compartir igual y el repositorio se archivó el 4-jul-2026 |
| AniList | Descartada | Sus [términos](https://docs.anilist.co/guide/terms-of-use) prohíben usar la API como almacenamiento y la recolección masiva |

## Decisión

El catálogo es una **consulta en vivo a la API oficial de MyAnimeList v2**, autenticada con un Client ID (cabecera `X-MAL-CLIENT-ID`). El proyecto **no almacena el catálogo**: de cada anime visto guarda solo el id de MAL asociado al usuario, en Supabase Postgres con RLS.

Condiciones verificadas del [acuerdo de licencia y desarrollo de la API de MAL](https://myanimelist.net/static/apiagreement.html):

- La licencia es revocable (§12: MAL puede terminarla por cualquier motivo) y MAL puede limitar el uso o empezar a cobrar previo aviso (§6). No publica un límite numérico de peticiones.
- El uso no comercial está permitido; obtener ingresos o agregar publicidad requiere autorización escrita (§3(a)(xiv), §4(b)).
- El contenido debe obtenerse directamente de la API, sin scraping (§4(i)); no se puede alterar sin autorización (§3(a)(xii)).
- Se permite indicar la atribución, por ejemplo «authorized by MyAnimeList» (§3(a)(xiii)); no se pueden usar marcas de MAL en el nombre ni el logo de la app (§17) ni inducir a pensar que es un producto de MAL (§3(a)(xi)).

### Acceso a la API mediante el proxy `mal-proxy` (2026-10-12)

El navegador **nunca llama directamente a MAL**. Todas las consultas pasan por una Edge Function de Supabase, `mal-proxy`, que agrega la cabecera `X-MAL-CLIENT-ID` en el servidor.

Motivos:

- **Confidencialidad del Client ID:** el formulario de registro de MAL indica que «Client ID and Client Secret must not be disclosed». Si la web app llamara a MAL, el Client ID quedaría expuesto en el bundle de JavaScript y en las peticiones del navegador.
- **CORS:** según los reportes de la comunidad, MAL no envía cabeceras CORS; el proxy elimina ese problema sin importar el resultado del spike.

Reglas del proxy:

- El Client ID se guarda como **secreto de Supabase** (`MAL_CLIENT_ID`, con `supabase secrets set`) y nunca en el repositorio, en variables `VITE_*` ni en el código de `apps/web`.
- Solo reenvía peticiones `GET` a una **lista cerrada de endpoints** (búsqueda, detalle por id, temporada y ranking) y de campos (`fields`); rechaza el resto. No es un proxy abierto.
- Solo acepta peticiones de **usuarios con sesión iniciada**: exige un JWT de Supabase con rol `authenticated` y rechaza la clave anónima (el catálogo solo se puede ver con sesión iniciada; decisión del stakeholder, 2026-10-12). Responde CORS únicamente para `app.acruxanime.com` y las vistas previas de desarrollo.
- Ofrece una consulta agrupada por lista de ids para la lista de vistos y la imagen para compartir, de modo que el navegador hace una petición en lugar de N.
- Devuelve cabeceras de caché (`Cache-Control`) para reducir la carga sobre MAL (§6: no imponer una carga irrazonable).

## Consecuencias

- **Positivas:** sin siembra ni mantenimiento del catálogo; datos siempre frescos; almacenamiento mínimo (solo ids).
- **Negativas / riesgos:**
  - **Dependencia dura en producción** de la disponibilidad, los límites y una posible revocación o cobro de la API de MAL.
  - Los filtros se limitan a lo que ofrece la API (ver «Resultados del spike»).
  - Listar los animes vistos de un usuario y generar la imagen para compartir exigen consultas por id (`GET /anime/{id}`): N peticiones. Se mitiga con agrupación y caché en el cliente (TanStack Query).
  - Las portadas son imágenes del CDN de MAL, mostradas tal como las devuelve la API: no se alojan ni se alteran.
  - Se muestra la atribución a MAL en la app (pantalla «Acerca de») y en la landing.
  - Restricción de uso no comercial: ingresos o publicidad exigen autorización escrita.
- **Resultados del spike (2026-10-12, con `curl` y el Client ID real contra `https://api.myanimelist.net/v2`):**

  | Prueba | Resultado observado |
  |---|---|
  | `GET /anime` sin `q` o con `q` de 2 caracteres | `400 invalid q`. La búsqueda exige al menos 3 caracteres: **no existe un listado completo navegable** del catálogo. |
  | `GET /anime?q=naruto&genre=1&media_type=movie&year=2002` | `200`, pero los parámetros de filtro **se ignoran en silencio** (devuelve las series de TV). La búsqueda **no filtra por género, tipo ni año**. |
  | `fields=media_type,start_season,genres,num_episodes,nsfw` en la búsqueda | Sí se devuelven: los filtros pueden aplicarse **en el cliente** sobre los resultados cargados. |
  | Paginación de la búsqueda (`q=love`, `limit=100`) | Tope de `limit` = 100. Las páginas traen menos elementos que `limit` (75–90) porque se excluye el contenido adulto. Sin resultados a partir de `offset` ≈ 700: **la búsqueda tiene un tope de resultados**. |
  | `nsfw` | Por defecto se excluye el contenido adulto; solo aparece con `nsfw=true`. |
  | `GET /anime/season/{year}/{season}` | Funciona; acepta `fields` y hasta 500 resultados por página (389 en otoño de 2023). Permite explorar **por año y temporada**. |
  | `GET /anime/ranking?ranking_type=movie` | Funciona. Permite explorar **por tipo** (`tv`, `movie`, `ova`, `special`, etc.) ordenado por ranking. |
  | `GET /anime/{id}?fields=...` | Funciona: título, tipo, temporada, géneros y portadas (`main_picture`) del CDN de MAL. |
  | Endpoint de consulta por varios ids | No existe: la lista de vistos requiere una consulta por id (la agrupa `mal-proxy`). |
  | CORS: `GET` con `Origin` | `200` **sin** cabeceras `Access-Control-*`. |
  | CORS: preflight `OPTIONS` | `405`. **Confirmado: el navegador no puede llamar a MAL directamente.** |
  | Sin `X-MAL-CLIENT-ID` | `403 forbidden`. |
  | Límites de uso | La respuesta no incluye cabeceras de límite (`X-RateLimit-*`, `Retry-After`). |

  No existe un endpoint para filtrar por género; el género solo puede filtrarse en el cliente.
- **Acciones derivadas:**
  - ~~Registrar la app en `myanimelist.net/apiconfig` para obtener el Client ID.~~ Hecho el 2026-10-12 (homepage `https://acruxanime.com/`, redirect `https://app.acruxanime.com/`). El Client ID se guarda fuera del repositorio.
  - ~~Spike al inicio del Sprint 0 para confirmar los filtros disponibles.~~ Hecho el 2026-10-12 (ver «Resultados del spike»).
  - Implementar la Edge Function `mal-proxy` con las reglas anteriores y cargar el secreto `MAL_CLIENT_ID`.
  - Esquema de almacenamiento: `seen_anime(user_id, mal_anime_id, created_at)` con RLS.

## Preguntas abiertas

- ~~**Conjunto final de filtros** tras el spike.~~ Resuelto el 2026-10-12: exploración por nombre o por año, con género como filtro en el cliente (ADR-0017).
- ~~**Proxy:** ¿se necesita la Edge Function `mal-proxy` (depende de CORS)?~~ Resuelto el 2026-10-12: sí, siempre, para no exponer el Client ID (ver «Acceso a la API mediante el proxy»).
- ~~¿El catálogo se puede explorar sin iniciar sesión?~~ Resuelto el 2026-10-12: no; el catálogo solo se ve con sesión iniciada y `mal-proxy` exige un usuario autenticado.
- **Datos mínimos desnormalizados** (título, portada) en la lista de vistos: el acuerdo (§3(c)) restringe guardar datos personales de usuarios de MAL, no datos del catálogo, pero hay que verificar si se permite almacenar contenido de MAL en el servidor antes de hacerlo. Por defecto se guarda solo el id.
