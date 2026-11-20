# ADR-0046: TVmaze como fuente de los dramas asiáticos

- **Estado:** Aceptado
- **Fecha:** 2026-11-19
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-19: «Quiero agregar al catalogo los doramas, kdramas y cdramas. Investiga de donde puedo obtener dicha información.»

**Complementa:** ADR-0043 (catálogo propio en Neon). No cambia la fuente del anime.

## Contexto

- El catálogo de Acrux viene de MyAnimeList (ADR-0043), que solo tiene animación. Los dramas de acción real necesitan otra fuente.
- Acrux va a tener anuncios y Plus (ADR-0036), así que la fuente debe permitir el uso comercial. Ese fue el criterio que bloqueó a AniList (ADR-0041).
- El 2026-11-19 se leyeron los términos de cada candidata y se midió la cobertura de TVmaze con dos pruebas.

### Prueba 1: muestra de 54 títulos

18 títulos por país (Corea, China y Japón), buscados por nombre en la API pública.

| País | Encontrados | Con imagen | Con sinopsis | Con episodios | Con ID de IMDb | Con ID de TheTVDB |
|---|---|---|---|---|---|---|
| Corea | 18/18 | 18/18 | 18/18 | 18/18 | 17/18 | 18/18 |
| China | 18/18 | 18/18 | 18/18 | 18/18 | 13/18 | 16/18 |
| Japón | 18/18 | 18/18 | 17/18 | 18/18 | 12/18 | 18/18 |

- «Nigeru wa Haji da ga Yaku ni Tatsu» no aparece por su título romanizado y sí por «We Married as a Job». La búsqueda resuelve alias en otros casos («Reply 1988», «Misaeng»).
- La muestra tiene títulos conocidos. No mide la cola larga.

### Prueba 2: recorrido del índice completo

Se recorrieron las 384 páginas del índice (91.253 series) y se contaron las series de tipo `Scripted` por país de la cadena o plataforma.

| País | Series guionadas | Con imagen | Con sinopsis | Con ID de TheTVDB | Estrenadas antes de 2010 |
|---|---|---|---|---|---|
| Corea | 2.527 | 97 % | 92 % | 81 % | 618 |
| Japón | 2.273 | 93 % | 85 % | 83 % | 438 |
| China | 3.812 | 99 % | 69 % | 33 % | 23 |
| Tailandia | 1.249 | 99 % | 90 % | 51 % | 31 |
| Taiwán | 221 | 98 % | 90 % | 80 % | 43 |
| Hong Kong | 164 | 93 % | 74 % | 80 % | 22 |

- El catálogo chino es casi todo reciente: 2.825 series de la década de 2020 y 449 sin fecha de estreno.
- Hay series sin país porque salen por plataformas globales: 1.584 en chino, 481 en coreano y 418 en japonés, contando todos los tipos. Solo se pueden clasificar por idioma.
- No se comparó la cobertura con MyDramaList.

### Prueba 3: series de época

El límite de 2010 de la prueba 2 es por año de estreno, no por la época en que transcurre la historia. Para confirmarlo se buscaron 32 series de época (wuxia, xianxia, históricas, sageuk y taiga).

| País | Encontradas | Faltantes |
|---|---|---|
| China | 15/16 | «My Fair Princess» (1998) |
| Corea | 9/10 | «Queen Seondeok» (2009), buscada solo por ese título |
| Japón | 6/6 | — |

- «The Untamed» está, con 50 episodios y los alias «陈情令» y «Chén Qíng Lìng».
- **Títulos.** No hay títulos en español: «El indomable» no devuelve nada. El pinyin sin tildes («Chen Qing Ling») tampoco la encuentra; el título original en caracteres sí.
- **Género.** No existe un género «de época». El más cercano es `History`, y no es consistente: «The Untamed» figura como Drama, Romance y Mystery.
- **Coincidencias dudosas.** «Ashes of Love» devolvió una entrada con estreno 2026-02-19 y la original es de 2018. «Journey to the West» no trae fecha. Hay que revisar los homónimos al cargar.

## Opciones

### Opción A: TVmaze

- **Términos** (https://www.tvmaze.com/api): licencia CC BY-SA 4.0. Los datos «can freely be used for any purpose, as long as TVmaze is properly credited as source and your usage complies with the ShareAlike provision». El crédito se cumple con un enlace a TVmaze.
- **Ventajas:**
  - es la única candidata con licencia abierta, sin pedir autorización;
  - no usa API key y permite al menos 20 pedidos cada 10 segundos por IP;
  - trae episodios, alias e IDs de IMDb y TheTVDB;
  - las imágenes se pueden enlazar directo y guardar en caché sin plazo.
- **Desventajas:**
  - no filtra por país ni por idioma: hay que bajar el índice completo y filtrar;
  - cobertura pobre de dramas chinos anteriores a 2010;
  - la página no dice qué licencia tienen las imágenes;
  - la cláusula ShareAlike alcanza a lo que se derive de sus datos.

### Opción B: TMDB

- **Términos** (https://www.themoviedb.org/api-terms-of-use, actualizados el 2023-10-20): el uso gratuito es solo no comercial. Generar ingresos con anuncios o con cobro a los usuarios cuenta como uso comercial y exige un acuerdo escrito con TMDB. El precio no está publicado. Prohíbe guardar datos en caché más de 6 meses.
- **Ventajas:** se la considera la de mejor cobertura de dramas asiáticos. No se midió.
- **Desventajas:** depende de un acuerdo comercial con costo desconocido; el límite de caché obliga a refrescar todo el catálogo dos veces al año.

### Opción C: MyDramaList

- **Términos:** la API está en beta privada y la key se pide por formulario (`mydramalist.com/api_request`). No hay términos públicos de uso comercial.
- **Ventajas:** es la referencia del nicho.
- **Desventajas:** no hay acceso garantizado. Las herramientas de terceros son scrapers y quedan descartadas.

### Opción D: Simkl

- **Términos** (https://api.simkl.org/api-rules): gratis para apps comerciales con menos de 150 USD de ingresos al mes. Usar solo el catálogo, sin ofrecer la sincronización con Simkl, exige contactarlos antes.
- **Desventajas:** el umbral de ingresos obliga a renegociar al crecer; no se midió su cobertura de dramas.

### Opción E: Wikidata

- **Términos:** CC0, sin restricciones.
- **Desventajas:** no trae episodios ni portadas confiables. Sirve para cruzar identificadores, no como fuente principal.

## Decisión

**Opción A**, aceptada por el stakeholder el 2026-11-20.

1. **Fuente.** Los dramas de acción real se cargan desde la API pública de TVmaze, solo desde el servidor, igual que MyAnimeList en ADR-0043.
2. **Alcance inicial.** Series de tipo `Scripted` de Corea y Japón. China entra con la cobertura que hay, sabiendo que faltan los títulos anteriores a 2010.
3. **Carga.** Un trabajo programado recorre el índice completo, filtra por país y por idioma, y guarda el resultado en el catálogo propio. El recorrido completo tardó más de 10 minutos respetando el límite de pedidos.
4. **Crédito.** Las pantallas que muestran datos de dramas dicen «Datos de TVmaze» con un enlace, junto al crédito de MyAnimeList.
5. **Títulos.** Los dramas se muestran y se buscan por su título internacional, el que trae TVmaze. No se cargan títulos en español (decisión del stakeholder, 2026-11-20: «Los titulos serán internacionales»). Los alias de TVmaze se guardan para que la búsqueda encuentre también el título original.
6. **Pedidos en paralelo.** Se pide autorización comercial a TMDB y acceso a la API de MyDramaList, para cubrir los dramas chinos más adelante. No bloquean esta decisión.

## Consecuencias

- **Positivas:**
  - los dramas no dependen de la autorización de un tercero, a diferencia de lo que pasó con AniList;
  - reutiliza el diseño de catálogo propio de ADR-0043.
- **Negativas / riesgos:**
  - **ShareAlike.** Los datos derivados de TVmaze deben ofrecerse bajo CC BY-SA. Hay que mantenerlos separados de los datos de MyAnimeList y de los datos de los usuarios, que no tienen esa licencia. El stakeholder debe leer la licencia antes de publicar: https://creativecommons.org/licenses/by-sa/4.0/.
  - **Imágenes.** La licencia de las portadas no está declarada. Queda por confirmar con TVmaze antes de usarlas en la tarjeta para compartir.
  - **Dos fuentes.** El catálogo pasa a tener dos identificadores externos (MyAnimeList y TVmaze) y dos créditos.
  - **Cobertura china.** Los usuarios que busquen dramas chinos estrenados antes de 2010 no los van a encontrar. Las series de época recientes sí están.
  - **Búsqueda en español.** TVmaze no trae títulos en español y se decidió no cargarlos (punto 5). Buscar «El indomable» no encuentra nada; hay que buscar «The Untamed».
  - **Filtro de época.** No hay un dato confiable para filtrar las series de época.

## Pendiente de definir

- Si los dramas comparten la tabla de catálogo con el anime o van en una tabla aparte.
- Cómo se agrupan las temporadas: TVmaze modela una serie con temporadas, no franquicias con relaciones como MyAnimeList.
- Si Tailandia, Taiwán y Hong Kong entran al alcance.
- Cómo se presentan los dramas en la app, que hoy se llama y se muestra como un producto de anime.
