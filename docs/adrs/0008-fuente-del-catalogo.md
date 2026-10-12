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

## Consecuencias

- **Positivas:** sin siembra ni mantenimiento del catálogo; datos siempre frescos; almacenamiento mínimo (solo ids).
- **Negativas / riesgos:**
  - **Dependencia dura en producción** de la disponibilidad, los límites y una posible revocación o cobro de la API de MAL.
  - Los filtros se limitan a lo que ofrece la API (ver «No verificado»).
  - Listar los animes vistos de un usuario y generar la imagen para compartir exigen consultas por id (`GET /anime/{id}`): N peticiones. Se mitiga con agrupación y caché en el cliente (TanStack Query).
  - Las portadas son imágenes del CDN de MAL, mostradas tal como las devuelve la API: no se alojan ni se alteran.
  - Se muestra la atribución a MAL en la app (pantalla «Acerca de») y en la landing.
  - Restricción de uso no comercial: ingresos o publicidad exigen autorización escrita.
- **No verificado (validar con un spike al inicio del Sprint 0):** la página de documentación oficial se renderiza con JavaScript y no pudo leerse. Fuentes de la comunidad ([especificación](https://github.com/SuperMarcus/myanimelist-api-specification), [paquete myanimelist.net](https://npmjs.com/package/myanimelist.net)) indican que:
  - `GET /anime` solo acepta `q`, `limit`, `offset` y `fields`, sin filtros de género, tipo ni año.
  - El año se obtiene con `GET /anime/season/{year}/{season}`, y existe `GET /anime/ranking` (`ranking_type`: tv, movie, ova, special, etc.).
  - MAL no envía cabeceras CORS ([fuente](https://github.com/jraleman/anime)), por lo que el navegador no podría llamar a la API directamente.
- **Acciones derivadas:**
  - Registrar la app en `myanimelist.net/apiconfig` para obtener el Client ID.
  - Spike al inicio del Sprint 0 para confirmar los filtros disponibles y el comportamiento de CORS.
  - Si CORS lo bloquea, crear un proxy como Edge Function de Supabase (`mal-proxy`); además mantiene el Client ID fuera del bundle del navegador.
  - Esquema de almacenamiento: `seen_anime(user_id, mal_anime_id, created_at)` con RLS.

## Preguntas abiertas

- **Conjunto final de filtros** tras el spike; impacta el alcance de ADR-0009.
- **Proxy:** ¿se necesita la Edge Function `mal-proxy` (depende de CORS)?
- **Datos mínimos desnormalizados** (título, portada) en la lista de vistos: el acuerdo (§3(c)) restringe guardar datos personales de usuarios de MAL, no datos del catálogo, pero hay que verificar si se permite almacenar contenido de MAL en el servidor antes de hacerlo. Por defecto se guarda solo el id.
