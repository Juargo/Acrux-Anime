# ADR-0024: Fuente del catálogo: AniList, consultada desde el navegador

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 006 y decisiones del 26-oct-2026 (mantener AniList, pedir autorización a AniList y a MyAnimeList como plan B); sesión con el stakeholder, 2026-10-27 (consulta desde el navegador).

**Reemplaza:**

- ADR-0008 completo (catálogo en vivo desde la API oficial de MyAnimeList).
- ADR-0018, sección «Reglas heredadas de `mal-proxy`», y la intermediación de la API con MAL (punto 1 de su contexto) y el cruce del catálogo con las marcas en el servidor (punto 2).
- ADR-0017: las operaciones de catálogo que asignaba a la API pasan al navegador. La experiencia de exploración (por nombre o por año, con filtros de género y tipo) sigue vigente.

## Contexto

- El 26-oct-2026 el stakeholder decidió **mantener AniList** como fuente del catálogo, tras revisar MyAnimeList, Kitsu, TMDB, AniDB y conjuntos de datos abiertos. Se pide autorización escrita a AniList y, en paralelo, a MyAnimeList como plan B (riesgo R-01).
- AniList aporta lo que el producto necesita y MAL no: las **relaciones entre entradas** (secuela, precuela, historia paralela, spin-off), base del agrupamiento por franquicia (RF-14, RF-15, RDI-30), y la cuenta del usuario para sincronizar (RF-02, RF-03).
- Términos de AniList (Restricciones RES-20 a RES-25):
  - Prohibido usarla como almacenamiento o respaldo, y la recolección masiva (RES-22).
  - Límite de 90 peticiones por minuto, hoy reducido a 30 (RES-23).
  - Uso comercial gratuito solo bajo US$150/mes de ingresos (RES-21).
  - Autorización escrita antes de publicar (RES-25).
- La API GraphQL pública de AniList **no requiere clave** para consultar el catálogo y acepta peticiones desde el navegador (CORS). Por eso desaparece el motivo principal del proxy de ADR-0008, que existía para ocultar el Client ID de MAL.

## Opciones consideradas

### Opción A: Desde el navegador del usuario

- **Ventajas:** el límite de peticiones se aplica a cada usuario y no a todo Acrux, porque cada navegador hace sus propias consultas; no hay costo de servidor ni almacenamiento (RES-22); una pieza menos en la API.
- **Desventajas:** no hay caché compartida entre usuarios; la lógica de agrupamiento corre en el cliente.

### Opción B: Proxy en el backend con caché corta

- **Ventajas:** control centralizado y caché compartida.
- **Desventajas:** **todas las consultas de todos los usuarios comparten el límite de 30 por minuto de una sola IP**; la caché en el servidor roza la prohibición de almacenamiento; la carga sobre las funciones de Vercel aumenta.

### Opción C: Híbrido

- **Ventajas:** el servidor podría generar la tarjeta o precalcular franquicias.
- **Desventajas:** suma la complejidad de las dos opciones sin un beneficio claro hoy.

## Decisión

**Opción A.** El navegador consulta `https://graphql.anilist.co` directamente. La API propia no intermedia el catálogo.

### Reglas

1. **Sin almacenamiento del catálogo:** la caché es solo en memoria (TanStack Query, sin persistencia en `localStorage` ni IndexedDB). El service worker de la PWA (ADR-0016) **no** cachea respuestas de AniList.
2. **Solo se guardan identificadores:** la API guarda `anilist_id` y, si existe, `mal_id` (el `idMal` que entrega AniList), según RDI-13. Guardar `mal_id` mantiene abierto el plan B.
3. **Consultas mínimas:** cada consulta pide solo los campos que usa la pantalla. La lista de vistos y la tarjeta usan **una consulta por lotes** (`Page.media(id_in: [...])`) en lugar de una por título.
4. **Respeto del límite:** el cliente lee las cabeceras `X-RateLimit-Remaining` y `Retry-After`; ante un `429`, espera y reintenta con retroceso exponencial, y muestra el mensaje de RNF-21 sin perder lo marcado.
5. **Datos externos validados:** cada respuesta de AniList se valida con Zod antes de usarse (ADR-0028).
6. **Agrupamiento en `packages/domain`:** el cálculo de la franquicia a partir de las relaciones (RDI-30) es una función pura del dominio (ADR-0019), que aplica primero las correcciones del curador (`GET /api/v1/franchise-overrides`, ADR-0023).
7. **Filtros nativos:** a diferencia de MAL, AniList filtra por año (`seasonYear`), género (`genre_in`) y formato (`format_in`) en el servidor; los filtros de ADR-0017 dejan de calcularse en el cliente.
8. **Contenido adulto excluido** (`isAdult: false`) en todas las consultas.
9. **Atribución a AniList** en la pantalla «Acerca de» y en la landing. «AniList» no aparece en el nombre de la app (RES-24).
10. **Plus no se cobra sin autorización y licencia de AniList** (R-01, RES-21). La validación y la beta funcionan sin ingresos.

## Consecuencias

- **Positivas:** sin costo de servidor para el catálogo; el límite de peticiones escala con la cantidad de usuarios; cumplimiento de RES-22 por diseño; filtros por año, género y tipo resueltos por AniList.
- **Negativas / riesgos:**
  - **Dependencia dura de AniList:** si no autoriza el modelo de Acrux, la app se queda sin catálogo (R-01). El plan B es MyAnimeList; como MAL bloquea CORS y exige ocultar su Client ID, cambiar a MAL obligaría a volver a un proxy en la API.
  - Un usuario muy activo puede alcanzar el límite de 30 peticiones por minuto desde su navegador; se mitiga con consultas por lotes, caché en memoria y retroceso.
  - Para generar la tarjeta en el navegador, las portadas del CDN de AniList deben servirse con CORS; si no, el canvas queda bloqueado (ver acciones derivadas).
- **Acciones derivadas:**
  - Spike: confirmar CORS de `graphql.anilist.co` y del CDN de imágenes de AniList, y el límite vigente.
  - Implementar el cliente GraphQL tipado con validación Zod y la política de reintentos.
  - Agregar `graphql.anilist.co` y el CDN de AniList a la CSP (ADR-0028).
  - Enviar los correos de autorización a AniList y MyAnimeList, incluida la consulta por el costo de la licencia comercial (R-02).
