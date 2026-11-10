# ADR-0041: MyAnimeList como plan B de la fuente de datos

- **Estado:** Aceptado
- **Fecha:** 2026-11-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Respuesta del soporte de MyAnimeList (2026-11-06) al pedido de autorización de #6; sesión con el stakeholder, 2026-11-10.

**Complementa:** ADR-0036, punto 4 (ni anuncios ni cobro sin la autorización de AniList), y el riesgo R-05.

## Contexto

- Acrux consume AniList desde el navegador (ADR-0024). Los términos actuales de AniList prohíben usar su API en trackers de anime que compitan con AniList, sin texto de excepción (RES-20, R-01).
- El 2026-10-29 se pidió autorización por escrito a AniList y a MyAnimeList (#6). AniList todavía no respondió.
- El 2026-11-06 respondió el soporte de MyAnimeList:
  > Presently, our API can be used commercially without license or screening.
  > To use MAL API, please create an account and sign up for an ID for API usage via the following page: https://myanimelist.net/apiconfig
  > We kindly request that you credit MyAnimeList wherever our data is used, referred to, or published.
  > We don't have any guidelines regarding crediting, but we would appreciate a link wherever it is used.
  >
  > Please note that access may be restricted if request counts become excessive and impose a burden on our system.
- Cada marca ya guarda `mal_id` cuando AniList lo informa (`apps/api/prisma/schema.prisma`).
- Una prueba desde el origen de la app (2026-11-10, sin client ID) respondió 403 sin encabezados CORS. Falta confirmarlo con un client ID, pero R-05 ya asumía que MAL no admite pedidos desde el navegador.

## Opciones

### Opción A: seguir solo con AniList y esperar su respuesta

- **Ventajas:** no hay trabajo nuevo.
- **Desventajas:** los anuncios y el cobro siguen bloqueados sin fecha; si AniList dice que no, no hay salida preparada.

### Opción B: migrar ya a MyAnimeList

- **Ventajas:** el uso comercial queda autorizado por escrito.
- **Desventajas:**
  - el catálogo pasa a un proxy en la API, por CORS;
  - el agrupamiento por franquicia hay que reescribirlo sobre `related_anime`;
  - las marcas, los overrides del curador y las tarjetas guardan IDs de AniList y habría que migrarlos;
  - todo eso puede ser trabajo innecesario si AniList autoriza.

### Opción C: dejar MyAnimeList preparado como plan B y migrar solo si AniList no autoriza

- **Ventajas:** mantiene la salida sin pagar la migración por adelantado.
- **Desventajas:** la decisión final queda pendiente de AniList.

## Decisión

**Opción C.**

1. La respuesta de MyAnimeList queda registrada como autorización para uso comercial, con dos condiciones: dar crédito con enlace y no cargar su sistema con pedidos excesivos.
2. El stakeholder registra un client ID en https://myanimelist.net/apiconfig. El ID no es secreto, pero se guarda como variable de entorno y no en el código.
3. Se sigue esperando a AniList. Ni anuncios ni cobro en producción mientras la fuente sea AniList sin autorización (ADR-0036, punto 4).
4. Si AniList dice que no, o no responde antes de activar anuncios o cobro, se migra a MyAnimeList con un ADR propio que cubra: proxy y caché en la API, agrupamiento por `related_anime`, migración de IDs usando `mal_id`, y el crédito «Datos de MyAnimeList» con enlace en las pantallas que muestren sus datos.

## Consecuencias

- **Positivas:** R-01 deja de ser un riesgo sin salida: hay una fuente con uso comercial autorizado.
- **Negativas / riesgos:**
  - migrar sigue siendo un trabajo grande, que toca datos guardados;
  - las marcas sin `mal_id` necesitan un mapeo manual o quedan fuera;
  - MyAnimeList no publica un límite de pedidos, así que la API necesita caché antes de pasar a producción.
