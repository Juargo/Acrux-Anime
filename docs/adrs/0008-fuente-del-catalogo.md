# ADR-0008: Fuente y siembra del catálogo de anime

- **Estado:** Propuesto (la decisión D10 se reabrió en la Reunión 005; se cierra en la Reunión 006)
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (S2, R5), Reunión 002 (implicaciones), Reunión 003 (D10, investigación), Reunión 005 (revisión)

## Contexto

La app gira en torno a una gran lista de animes marcables, con búsqueda por nombre y filtros por año, género y tipo (ADR-0009). Debe incluir todos los formatos: TV, película, OVA, ONA, especial (D6).

El stakeholder pidió una fuente que **permita sembrar un set de datos propio** en Postgres (Reunión 003). Con un catálogo propio en Supabase los filtros son rápidos y la app no depende de una API externa en cada búsqueda (Reunión 002).

## Opciones consideradas

| Criterio | AniList | Jikan (datos de MyAnimeList) | anime-offline-database |
|---|---|---|---|
| Permite guardar datos | **No.** Sus [términos](https://docs.anilist.co/guide/terms-of-use) prohíben usar la API como almacenamiento y la recolección masiva | **No confirmado.** El [README de Jikan](https://github.com/jikan-me/jikan-rest) remite a los términos de MyAnimeList | Sí: licencia ODbL v1.0 + DbCL v1.0 ([repositorio](https://github.com/manami-project/anime-offline-database)); falta leer el LICENSE para las condiciones de atribución y de compartir igual |
| Géneros | Curados | Campo propio y curado (los de MAL) | No hay campo; son etiquetas sin curar que hay que mapear |
| Esfuerzo de siembra | — | Muchas peticiones paginadas con límite de velocidad | Descargar un JSON (~41.500 entradas) |
| Frescura | Al día | Al día | Foto estática: el repositorio se archivó el 4-jul-2026 |
| Dependencia en producción | — | Ninguna si se siembra; total si se usa en vivo | Ninguna |

Otra variante analizada: **Jikan en vivo**, sin guardar nada. Baja el riesgo legal, pero cada búsqueda y filtro dependería de una API pública no oficial, lo que choca con la meta de confiabilidad.

## Decisión

**Pendiente** (Reunión 006).

- **AniList queda descartada** por sus términos de uso.
- **Recomendación del analista:** mantener la D10, es decir, **sembrar el catálogo una sola vez desde anime-offline-database** en el Postgres de Supabase. La reserva sobre Jikan es legal, no técnica: no se pudo verificar que los términos de MyAnimeList permitan guardar sus datos y portadas en una base propia para una app publicada en tiendas.
- La decisión final es del stakeholder.

## Consecuencias (si se confirma anime-offline-database)

- **Positivas:** licencia abierta; siembra simple y reproducible; ninguna dependencia externa en producción.
- **Negativas / riesgos:**
  - No incluye estrenos posteriores al archivo del repositorio. Se acepta para el MVP.
  - Hay que **definir una lista curada de unos 20 géneros** y mapear las etiquetas del dataset en el script de siembra.
  - La licencia exige atribución visible: pantalla «Acerca de» en la app y en la landing.
- **Acciones derivadas:**
  - Leer el LICENSE del dataset y documentar las obligaciones de atribución.
  - Escribir `scripts/seed-catalog` (ADR-0004): descarga, normalización, mapeo de géneros y carga en Postgres.
  - Crear índices para la búsqueda por nombre (texto completo o trigramas) y para los filtros.

## Preguntas abiertas

- **Fuente final:** Jikan o anime-offline-database (Reunión 006).
- **Lista curada de géneros:** la propone el analista y la aprueba el stakeholder.
- **Imágenes (R9):** las portadas son URLs de terceros. ¿Se usan directamente o se alojan en un storage propio? Hay que verificar los términos antes de publicar.
- ¿Se actualizará el catálogo después del MVP? ¿Con qué fuente?
