# Sección de dramas en la web, separada del anime (issue #151; parte web del #149)

Objetivo: la web muestra los dramas en su propia sección, con catálogo, filtros, búsqueda y crédito a TVmaze, sin tocar el catálogo de anime. Rama `feat/seccion-dramas`. Entrega: `ask-on-risk`, cadena `feature-branch-chain` si pasa de unas 400 líneas. Pruebas: `pnpm --filter @acrux/web test` (Vitest) y `pnpm --filter @acrux/e2e test` (Playwright).

## Specs

- **S1.** Pedido del stakeholder (2026-11-20), tras elegir el #151 como siguiente: «continurmos».
- **S2.** Entrada a la sección. El stakeholder respondió «si» a «¿Vamos con el selector dentro de Explorar?». La opción, tal como se le presentó: «un selector «Anime / Dramas» arriba de Explorar, con los dramas en la ruta `/dramas`. La barra queda en cuatro ítems y la separación se ve apenas entrás».
- **S3.** Filtro por eras. El stakeholder respondió «si» a «¿Lo dejamos sin filtro por eras por ahora?». La opción: «no ponerlo en esta primera versión y dejar solo los filtros que la API ya tiene: origen (Corea, Japón, China) y género».
- **S4.** Marcas. El stakeholder respondió «si» a «¿Sacamos la sección sin marcas y dejo el marcado de dramas como issue aparte?». La opción: «en esta primera versión no se marquen: la sección sale como catálogo para explorar y buscar». El marcado quedó en el issue #154.
- **S5.** Tareas del issue #151:
  - «Sección de dramas con su catálogo, separada del catálogo de anime»
  - «Tarjeta de drama con título internacional, portada, país, año, temporadas y episodios»
  - «Filtros que se definan arriba» (S3: origen y género)
  - «Textos en español y en inglés»
- **S6.** Criterios de aceptación del issue #151:
  - «El catálogo de anime no muestra dramas y el de dramas no muestra anime»
  - «Una serie sin detalle todavía (sin temporadas ni episodios) se muestra sin datos falsos»
  - «La sección de dramas lleva el crédito de TVmaze»
- **S7.** Parte web del issue #149:
  - Tareas: «Campo de búsqueda en la sección de dramas de la web» y «Mensaje cuando la búsqueda no encuentra nada, que aclare que los títulos están en su versión internacional»
  - Criterio: «Buscar «El indomable» no encuentra nada y se muestra el mensaje de títulos internacionales»
- **S8.** Del issue #150, solo lo que exige S6: «Toda pantalla que muestra un drama tiene el crédito visible, con un enlace a TVmaze» y «Las pantallas de anime siguen mostrando solo el crédito de MyAnimeList».
- **S9.** Fuera de alcance: marcar dramas y el contador (#154); el crédito a TVmaze en «Acerca de» y los textos legales de la landing (resto del #150); filtro por eras, año o década; Tailandia, Taiwán y Hong Kong; filtro por época de la historia.

Datos que ya existen, no se cambian:

- API (#148, #149): `GET /api/v1/dramas?search=&origin=KR|JP|CN&genres=a,b&page=N` responde `{ items, nextPage }`, 50 por página por popularidad; `GET /api/v1/dramas/genres` responde `{ items }`. Cada drama trae `id`, `title`, `aliases`, `summary`, `coverUrl`, `tvmazeUrl`, `country`, `language`, `origin` (`KR`, `JP`, `CN` o nulo), `year`, `seasons`, `episodes` y `genres`. `seasons` y `episodes` son nulos hasta que la carga lee el detalle. La búsqueda ignora mayúsculas, tildes y marcas de tono.

Supuestos, no pedidos por el stakeholder:

- «País» en la tarjeta es el `origin` de la API (Corea, Japón o China); una serie sin origen no muestra país.
- El ítem «Explorar» de la barra queda activo también en `/dramas`.
- La sección de dramas no lleva espacio de anuncio: nadie lo pidió.
- La tarjeta de drama no enlaza a ninguna pantalla de detalle: no existe una para dramas.

## Tasks

- [x] **T1** (S5, S6) Cliente y consultas de dramas en la web, contra la API propia. Ruta: delegada (respaldo de contexto: la sesión ya pasó por una compactación). Commit: rama `feat/seccion-dramas-1-cliente`.
- [x] **T2** (S3, S4, S5, S6, S7, S8) Pantalla de dramas: tarjetas, filtros de origen y género, búsqueda con el mensaje de títulos internacionales, crédito a TVmaze y textos en español e inglés. Ruta: delegada, mismo motivo. Commit: rama `feat/seccion-dramas-2-pantalla`.
- [x] **T3** (S2, S6) Selector «Anime / Dramas» en Explorar, ruta `/dramas` y prueba de punta a punta. Ruta: delegada, mismo motivo. Commit: rama `feat/seccion-dramas-3-selector`.

## Log

- **L1.** Pedido original del stakeholder, 2026-11-20: «continurmos», con el #151 propuesto como siguiente. Las tres definiciones previas del issue se resolvieron con un «si» cada una (S2, S3, S4).
- **L2.** Previsión: unas 900 líneas escritas con pruebas. Pasa de 400, así que se entrega en cadena sobre esta rama, con un corte por tarea.
- **L3.** Escrito por un trabajador delegado y revisado por el orquestador. Rojo y verde observados por regla; `pnpm --filter @acrux/web test`: 472 de 472; `typecheck` y `biome check` sin errores. El recorrido de Playwright (`apps/e2e/tests/dramas.spec.ts`) está escrito y carga, pero no se corrió en local: necesita una base de datos descartable. Queda para el CI del PR.
- **L4.** Decisiones de implementación: la grilla de dramas carga de a 50 con un botón «Ver más», no con el desplazamiento infinito del anime. Los textos de sin conexión y de error son los del catálogo de anime. `getJson` sale de `catalog-source/client.ts` sin cambiar su comportamiento, para que los dos catálogos fallen igual.
- **L5.** Tamaño real: unas 1.450 líneas en tres commits (290, 693 y 467), más de la mitad pruebas.
- **L6.** Entrega en cadena sobre `feat/seccion-dramas`, que es la rama de integración: `-1-cliente` apunta a ella, `-2-pantalla` a `-1-cliente` y `-3-selector` a `-2-pantalla`. Se fusionan de arriba hacia abajo.
- **L7.** El recorrido de Playwright falló en el CI del corte 3: en celular la barra inferior (capa 20) tapaba los botones de la hoja de filtros (capa 10), así que «Ver resultados» no recibía el clic. El defecto es anterior a este trabajo y afecta igual a la hoja de filtros del anime. Corrección: la hoja pasa a la capa 25. Reproducido y verificado en local con Postgres descartable: 13 de 13 recorridos en Chromium.
