# ADR-0017: Exploración del catálogo: por nombre o por año, con filtros de género y tipo

- **Estado:** Aceptado (las operaciones de catálogo pasan al navegador contra AniList, ADR-0024; la experiencia de exploración sigue vigente)
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-12, a partir de los resultados del spike de la API de MAL (ADR-0008). Reemplaza los ítems 1–3 de ADR-0009 (gran lista marcable, búsqueda por nombre, filtros por año, género y tipo).

## Contexto

ADR-0009 definía el catálogo como **una gran lista marcable** con búsqueda por nombre y filtros por año, género y tipo. El catálogo es una consulta en vivo a la API oficial de MyAnimeList v2 (ADR-0008), y el spike del 2026-10-12 mostró que:

- No existe un listado completo del catálogo: la búsqueda exige al menos 3 caracteres.
- La búsqueda ignora los parámetros de filtro; devuelve hasta unos 700 resultados, en páginas de 100 como máximo.
- `GET /anime/season/{year}/{season}` devuelve una temporada completa (hasta 500 por página).
- No existe ningún endpoint por género; el género llega como campo (`genres`) en los resultados.

## Opciones consideradas

### Opción A: Buscar por nombre o explorar por temporada, con filtros en el cliente

- **Ventajas:** resultados completos por temporada.
- **Desventajas:** el usuario tiene que elegir temporada además del año; no es el modelo mental del stakeholder.

### Opción B: Buscar por nombre o explorar por año, con género como filtro en el cliente

- **Ventajas:** explorar por año sin escribir nada; resultados completos (el año son sus 4 temporadas); el filtro de género siempre se aplica sobre un conjunto completo y conocido.
- **Desventajas:** no se puede explorar por género sin elegir antes un año o escribir un nombre.

### Opción C: Explorar por género sobre el ranking general

- **Ventajas:** permite partir del género.
- **Desventajas:** solo cubre los animes más populares del ranking; el resultado sería parcial y engañoso.

## Decisión

**Opción B.** El catálogo tiene **dos formas de exploración**, excluyentes:

1. **Por nombre:** búsqueda desde 3 caracteres (`GET /anime?q=`), con paginación.
2. **Por año:** el usuario elige un año y ve **todos los animes estrenados ese año**. `mal-proxy` consulta las 4 temporadas (`winter`, `spring`, `summer`, `fall`), une los resultados sin duplicados y **conserva solo los que tienen `start_season.year` igual al año elegido** (decisión del stakeholder, 2026-10-12). El selector de año va **del año actual hacia atrás hasta 1917**, con el año actual seleccionado por defecto; el año actual se calcula en tiempo de ejecución, no se fija en el código.

Sobre los resultados de cualquiera de las dos se aplican, **en el cliente**, dos filtros combinables:

- **Género**, a partir del campo `genres` que devuelve MAL. Los géneros disponibles son los que aparecen en los resultados cargados; no hay lista curada propia.
- **Tipo** (TV, película, OVA, ONA, especial, etc.), a partir del campo `media_type` (se mantiene D11; decisión del stakeholder, 2026-10-12).

Se mantienen de ADR-0009: todos los formatos (TV, película, OVA, ONA, especial; D6), marcar como visto con el contador total, la imagen para compartir y la pantalla «Acerca de». El contenido adulto queda excluido (comportamiento por defecto de MAL, sin `nsfw=true`).

## Consecuencias

- **Positivas:** encaja con lo que la API ofrece de verdad; los resultados filtrados son completos dentro del año o la búsqueda; se elimina la lista curada de géneros (ADR-0009).
- **Negativas / riesgos:**
  - Las temporadas de MAL incluyen series que **siguen en emisión** (en el spike, One Piece aparece en primavera de 2024). Como «por año» significa «estrenados ese año», `mal-proxy` descarta esas series filtrando por `start_season.year`; por eso la consulta debe pedir siempre el campo `start_season`. Una serie larga aparece solo en su año de estreno.
  - Un año puede tener más de mil animes: hay que paginar o virtualizar la lista en el cliente (TanStack Virtual) y cachear la respuesta del año en `mal-proxy` y en el cliente.
  - En la búsqueda por nombre, los filtros de género y tipo solo actúan sobre las páginas ya cargadas; hay que indicarlo en la interfaz o cargar todas las páginas (hasta ~700 resultados) antes de filtrar.
  - Los nombres de géneros y los valores de `media_type` vienen en inglés desde MAL; traducirlos al español requiere una tabla propia de traducciones (ADR-0010).
- **Acciones derivadas:**
  - Agregar a `mal-proxy` la operación «año completo» (4 temporadas unidas, sin duplicados) con caché.
  - Diseñar la pantalla de exploración: selector «Nombre / Año», selector de año y filtros de género y tipo.
  - Redactar las historias de usuario de exploración con estos criterios.

## Preguntas abiertas

- ~~¿Se mantiene el filtro por **tipo** (TV, película, OVA…) que pedía D11?~~ Resuelto el 2026-10-12: sí, como filtro en el cliente sobre `media_type`.
- ~~«Por año»: ¿animes en emisión ese año o solo los estrenados ese año?~~ Resuelto el 2026-10-12: solo los estrenados ese año.
- ~~Rango de años del selector.~~ Resuelto el 2026-10-12: del año actual hasta 1917, con el año actual por defecto.
