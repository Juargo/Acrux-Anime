# Catálogo propio con datos de MyAnimeList (ADR-0043)

Objetivo: reemplazar AniList por MyAnimeList como fuente de datos, con un catálogo propio en Neon servido por la API. Rama `feat/catalogo-myanimelist`. Entrega: `ask-on-risk`; estrategia de cadena pendiente de la respuesta del stakeholder. Runner: Vitest (`pnpm --filter @acrux/web test`, `pnpm --filter @acrux/api test`, `pnpm --filter @acrux/domain test`).

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

Pronóstico: más de 3.000 líneas cambiadas, muy por encima de 400. T6 y T7 deben llegar a producción juntas: la web no puede leer de MyAnimeList con marcas guardadas por ID de AniList.

| ID | Qué | Specs | Ruta | Estado | Commit |
|---|---|---|---|---|---|
| T1 | ADR-0043 y este documento | S1, S2 | inline | hecho | (este commit) |
| T2 | Dominio sin nombres ni valores de AniList; el adaptador de AniList sigue funcionando | S3 | inline | pendiente | — |
| T3 | Cliente de MyAnimeList en la API, tabla de catálogo y conversión al dominio | S2, S4, S7 | inline | bloqueada: falta el client ID | — |
| T4 | Trabajo programado de carga y refresco (riesgo ítem 5) | S2, S7 | inline | pendiente | — |
| T5 | Módulo de catálogo en la API: catálogo, géneros, animes por ID, franquicia | S2, S3, S4 | inline | pendiente | — |
| T6 | Web: cliente del catálogo en lugar del de AniList, mensajes de error, simulación en E2E | S3, S4 | por decidir | pendiente | — |
| T7 | Cambio de clave de marcas y overrides, contratos y rutas (riesgo ítems 1 y 3) | S5 | inline | pendiente | — |
| T8 | Crédito, CSP, i18n, landing, eventos y documentación | S6, S8 | inline | pendiente | — |
| T9 | Verificador independiente (T4 y T7) y vista previa | S1–S8 | verificador | pendiente | — |

## Log

- **L1 (2026-11-10):** «Voy a dejar los anuncios para más adelante. Quiero comenzar con el lanzamiento directo de la app. Que quedaría por hacer para que lo que hay esté listo para producción?»
- **L2 (2026-11-10):** «Migremos a Myanimelist».
- **L3 (2026-11-10):** «si», a la pregunta «¿Vamos con el catálogo propio (A)?».
- **L4:** Evidencia previa al diseño:
  - Mapa del código: el cliente de AniList vive en `apps/web/src/anilist/`; el agrupamiento, en `packages/domain/src/franchise/grouping.ts`; 12 pantallas y hooks reciben un `AniListClient`; `mark` tiene la clave `(user_id, anilist_id)` y `mal_id` puede ser nulo; `franchise_override` solo guarda IDs de AniList.
  - API de MyAnimeList: sin CORS (probado con `curl`, sin client ID); la referencia oficial no se pudo leer; los campos vienen de clientes de la comunidad y están sin confirmar.
  - No se sabe cuántas marcas de producción tienen `mal_id` nulo.
- **L5:** El lanzamiento directo se salta los umbrales de H1 y la beta de H2 (ADR-0031). Esa decisión necesita su propio ADR y queda fuera de este documento.
