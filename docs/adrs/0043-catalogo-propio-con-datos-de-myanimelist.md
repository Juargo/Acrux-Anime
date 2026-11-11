# ADR-0043: Catálogo propio en Neon con datos de MyAnimeList

- **Estado:** Aceptado
- **Fecha:** 2026-11-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-10: «Quiero comenzar con el lanzamiento directo de la app» y «Migremos a Myanimelist».

**Ejecuta:** ADR-0041, punto 4 (migrar a MyAnimeList si AniList no autoriza).

**Reemplaza:** ADR-0024, en lo referido a consumir AniList desde el navegador.

## Contexto

- AniList no respondió el pedido de autorización del 2026-10-29 (#6). Publicar con sus datos exige esa autorización (RES-25, ADR-0031). MyAnimeList autorizó el uso comercial por correo el 2026-11-06 (ADR-0041).
- Hoy el navegador pide a AniList cada página del catálogo con las relaciones incluidas y agrupa las franquicias con `@acrux/domain`. La API de Acrux no tiene módulo de catálogo y solo guarda IDs de AniList.
- La API de MyAnimeList no admite ese esquema:
  - No envía cabeceras CORS y responde 405 al preflight (probado con `curl`, sin client ID). El acuerdo de la API además prohíbe compartir el client ID con terceros.
  - Según los clientes de la comunidad, `related_anime` solo viene en el detalle de cada anime y no hay un endpoint para pedir varios animes juntos. Agrupar una página de 50 animes cuesta 50 pedidos.
  - Según las mismas fuentes, solo hay búsqueda por texto, rankings y temporadas: no hay filtro por género ni por año.
- La referencia oficial de la API no se pudo leer de forma automática. Los campos y los valores de esta decisión vienen de clientes de la comunidad y hay que confirmarlos con un client ID antes de construir sobre ellos.

## Opciones

### Opción A: catálogo propio en Neon

Un trabajo programado copia a Postgres los animes más populares con sus relaciones. El resto se completa cuando alguien lo busca. La API sirve el catálogo, los filtros y las franquicias desde esa tabla.

- **Ventajas:**
  - conserva los filtros por género, formato y año;
  - las páginas cargan rápido, sin depender de MyAnimeList en cada visita;
  - hace muy pocos pedidos a MyAnimeList, que es la condición que puso su soporte.
- **Desventajas:**
  - más trabajo: tabla, trabajo de carga y refresco, módulo de catálogo;
  - los datos pueden quedar desactualizados entre refrescos;
  - el acuerdo de la API no aclara si se puede guardar el catálogo.

### Opción B: proxy con caché por pedido

La API reenvía cada pedido a MyAnimeList y guarda la respuesta.

- **Ventajas:** menos código y menos datos guardados.
- **Desventajas:**
  - se pierden los filtros por género y por año;
  - la primera carga de cada página necesita 50 pedidos de detalle antes de poder agrupar.

## Decisión

**Opción A**, elegida por el stakeholder el 2026-11-10.

1. **Fuente.** La API de MyAnimeList v2 se consulta solo desde el servidor. El client ID va en la variable de entorno `MAL_CLIENT_ID` y nunca llega al navegador.
2. **Tabla de catálogo.** Una tabla en Neon guarda, por anime: ID de MyAnimeList, títulos, portada, tipo, fechas, géneros, episodios, duración, popularidad, clasificación de contenido, relaciones y fecha de la última lectura.
3. **Carga y refresco.** Un trabajo programado en GitHub Actions carga los animes más populares con su detalle y los refresca cada semana. Un anime que falta en la tabla se pide a MyAnimeList cuando alguien lo busca y queda guardado.
4. **Módulo de catálogo en la API.** Sirve el catálogo con búsqueda y filtros, los géneros, los animes por ID y los animes de una franquicia. El recorrido de secuelas y precuelas se hace en el servidor, sobre la tabla.
5. **Agrupamiento.** `groupFranchises` sigue en `@acrux/domain`, puro y compartido. Los tipos del dominio dejan de usar los nombres y los valores de AniList.
6. **Identificadores.** El ID de MyAnimeList pasa a ser el identificador de un anime en las marcas, en la tabla del curador, en las rutas y en los contratos de la API.
   - Las marcas y los overrides guardados se convierten con `mal_id`.
   - Una marca sin `mal_id` se resuelve consultando `idMal` en AniList una última vez, antes del cambio.
   - Lo que no se pueda resolver se exporta y se informa al stakeholder. No se borra en silencio.
7. **Crédito.** Las pantallas que muestran datos del catálogo dicen «Datos de MyAnimeList» con un enlace. Reemplaza al crédito de AniList en la app, en la landing y en los textos legales.
8. **Vínculo con AniList.** La vinculación y la sincronización con la lista de AniList (#40, #41; RF-02 a RF-04) salen del alcance del lanzamiento.

## Consecuencias

- **Positivas:**
  - la fuente de datos tiene el uso comercial autorizado por escrito, y deja de bloquear el lanzamiento, el cobro de Plus y los anuncios;
  - el catálogo ya no depende del límite de 30 pedidos por minuto de AniList en el navegador.
- **Negativas / riesgos:**
  - **Acuerdo de la API.** El texto del acuerdo prohíbe generar ingresos con una aplicación comercial sin autorización escrita y no aclara si se puede guardar el catálogo. El respaldo es el correo del soporte del 2026-11-06. El stakeholder debe leer el acuerdo antes de cobrar Plus: https://myanimelist.net/static/apiagreement.html.
  - **Datos guardados.** Cambiar la clave de las marcas y de los overrides modifica datos existentes. Necesita un respaldo previo y una migración que se pueda verificar.
  - **Enlaces.** Las rutas de franquicia cambian de ID. Los enlaces guardados a una franquicia dejan de servir.
  - **Portadas.** La tarjeta para compartir se dibuja en el navegador y necesita que el servidor de imágenes de MyAnimeList envíe cabeceras CORS. Si no las envía, las portadas tendrán que pasar por la API.
  - **Límite de pedidos.** MyAnimeList no publica un límite. El trabajo de carga va despacio y se detiene ante un 403 o un 429.

## Confirmado con el client ID (2026-11-11)

- **Campos.** Los endpoints de lista (búsqueda, ranking y temporada) aceptan los mismos campos que el detalle, salvo `related_anime`, que solo viene en el detalle. El ranking por popularidad recorre todo el catálogo, cerca de 31.000 animes, de a 500 como máximo. La búsqueda exige al menos 3 caracteres y devuelve hasta 100.
- **Formatos.** `media_type` trae `tv`, `movie`, `ova`, `ona`, `special`, `tv_special`, `music`, `pv`, `cm` y `unknown`. `tv_special` se guarda como especial; `pv` y `cm` conservan su nombre y no entran al catálogo, igual que la música.
- **Relaciones.** `sequel`, `prequel`, `side_story`, `parent_story`, `full_story`, `summary`, `alternative_version`, `alternative_setting`, `spin_off`, `character` y `other`. Se guardan con los nombres de `@acrux/domain`; `full_story` y `parent_story` van como `PARENT`, y las dos alternativas como `ALTERNATIVE`.
- **Contenido para adultos.** `nsfw` no sirve para distinguirlo: MyAnimeList marca el hentai como `gray`, igual que el ecchi. Un anime es para adultos si su clasificación es `rx` o tiene el género Hentai. Las listas se piden con `nsfw=true`, porque sin eso MyAnimeList omite también los títulos `gray` que sí se muestran.
- **Portadas.** `cdn.myanimelist.net` envía `Access-Control-Allow-Origin: *`, así que la tarjeta para compartir las lee sin pasar por la API.
- **Carga.** El trabajo lista todo el catálogo en unos 62 pedidos y lee 6.000 detalles por semana, uno por segundo. La primera carga se hace con dos corridas manuales de 16.000 detalles (`docs/runbooks/catalogo.md`).
- **Géneros.** El campo `genres` mezcla géneros, temas y demografías: son 77 valores entre los títulos que se muestran. El catálogo guarda solo los géneros, más Ecchi (decisión del stakeholder, 2026-11-11):
  - Action, Adventure, Avant Garde, Award Winning, Boys Love, Comedy, Drama, Ecchi, Fantasy, Girls Love, Gourmet, Horror, Mystery, Romance, Sci-Fi, Slice of Life, Sports, Supernatural y Suspense.
  - Los temas (School, Isekai…), las demografías (Shounen, Kids…) y los géneros eróticos no se guardan. El filtro, los géneros favoritos y las insignias por géneros usan esa lista.
