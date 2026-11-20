# Carga programada de dramas asiáticos desde TVmaze (issue #141, ADR-0046)

Objetivo: un trabajo programado copia los dramas de acción real de TVmaze a una tabla propia del catálogo. Rama `feat/carga-tvmaze`. Entrega: `ask-on-risk`, cadena `feature-branch-chain`: esta rama es la de integración, cada PR hijo apunta a la rama anterior de la cadena y `main` recibe un solo merge al final (L15). Runner: Vitest (`pnpm --filter @acrux/api test`).

## Specs

- **S1.** Pedido del stakeholder sobre el issue #141, «Carga programada de dramas asiáticos desde TVmaze»: «trabajemso ahora en esto».
- **S2.** Decisión del stakeholder: respondió «si» a «¿Vamos con tabla aparte para los dramas?». La opción, tal como se le presentó: «una tabla aparte (`drama`, con el ID de TVmaze como clave): no toca datos existentes, deja la separación de licencias resuelta por diseño y le da a la carga un rol de base de datos propio».
- **S3.** Decisión del stakeholder: «fila por serie». La opción, tal como se le presentó: «cada serie de TVmaze es una entrada, con su cantidad de temporadas y de episodios guardada como dato. No hace falta agrupar nada ni recalcular franquicias».
- **S4.** Tareas del issue #141:
  - «Cliente de TVmaze en el servidor, sin API key, que respete el límite de 20 pedidos cada 10 segundos por IP»
  - «Recorrido del índice completo y filtro de las series de tipo `Scripted` por país de la cadena o plataforma: Corea, Japón y China»
  - «Clasificación por idioma de las series sin país (las que salen por plataformas globales)»
  - «Guardado en el catálogo propio con el ID de TVmaze como identificador externo, más título internacional, alias, sinopsis, imagen, episodios e IDs de IMDb y TheTVDB»
  - «Datos de TVmaze separados de los de MyAnimeList y de los datos de los usuarios, por la cláusula ShareAlike (CC BY-SA 4.0)»
  - «Trabajo programado en GitHub Actions, con corrida manual, que no se pise con la carga de MyAnimeList»
  - «Migración y permisos del rol de base de datos que usa la carga»
- **S5.** Criterios de aceptación del issue #141:
  - «Una corrida completa deja en el catálogo las series `Scripted` de Corea, Japón y China que tiene TVmaze»
  - «Volver a correr la carga actualiza las series existentes y no las duplica»
  - «"The Untamed" queda guardada con 50 episodios y los alias "陈情令" y "Chén Qíng Lìng"»
  - «Dos series con el mismo título quedan como entradas distintas, identificadas por su ID de TVmaze»
  - «Cada serie guardada indica que su fuente es TVmaze»
  - «La carga se detiene al primer rechazo de TVmaze, igual que la de MyAnimeList»
- **S6.** Fuera de alcance, según el issue: el crédito «Datos de TVmaze» en las pantallas; la búsqueda y la presentación de los dramas en la app; Tailandia, Taiwán y Hong Kong; los pedidos a TMDB y a MyDramaList; confirmar con TVmaze la licencia de las portadas.

Supuestos, no pedidos por el stakeholder:

- La carga usa un rol nuevo, `acrux_dramas`, que solo llega a la tabla `drama`. El rol `acrux_catalog` queda como está: sus pruebas fijan que no lee ninguna otra tabla.
- La API todavía no sirve dramas (S6), así que `acrux_api` solo recibe lectura sobre `drama`.
- «Indica que su fuente es TVmaze» (S5) se cumple guardando la URL de la serie en TVmaze, que además sirve para el enlace del crédito.
- Una serie sin país entra si su idioma es coreano, japonés o chino. Una serie con país fuera de Corea, Japón y China no entra, aunque su idioma sea uno de esos.
- Los episodios y los alias no vienen en el índice: se leen con un pedido por serie. Solo se vuelve a leer una serie cuando TVmaze informa que cambió.
- La carga nunca borra una serie: una serie que TVmaze quita o reclasifica queda en la tabla.

## Tasks

Pronóstico: unas 900 líneas cambiadas, por encima de 400. Real al cerrar T3: 1.439.

| ID | Qué | Specs | Ruta | Estado | Commit |
|---|---|---|---|---|---|
| T1 | Este documento | S1–S6 | inline | hecho | rama de integración |
| T2 | Tabla `drama`, rol `acrux_dramas` y sus permisos (riesgo ítems 1 y 2) | S2, S3, S4 | inline | hecho | `-01-tabla` |
| T3 | Cliente de TVmaze, filtro por país e idioma, guardado y trabajo de carga con su comando | S3, S4, S5 | inline | hecho | `-02-pasos-comunes`, `-03-guardado`, `-04-cliente`, `-05-carga` |
| T4 | Workflow programado en GitHub Actions y runbook (riesgo ítem 5) | S4 | inline | hecho; falta la puesta en marcha en producción | `-05-carga` |
| T5 | Verificador independiente de T2 y T4 | S1–S6 | verificador | hecho; sin bloqueos (L13); corrección de un aviso (L14) | `-04-cliente` |

Ruta inline en todas: las tareas dependen una de otra (T3 usa la tabla de T2 y T4 el comando de T3), así que no hay unidades independientes para escribir en paralelo.

## Log

- **L1 (2026-11-20):** «creá el issue para implementar la carga de TVmaze». El issue quedó como #141 con prioridad «must».
- **L2 (2026-11-20):** «trabajemso ahora en esto».
- **L3 (2026-11-20):** «si», a la tabla aparte. Evidencia: `apps/api/prisma/schema.prisma` usa el ID de MyAnimeList como clave de `anime`, y las marcas apuntan a ese ID.
- **L4 (2026-11-20):** «fila por serie».
- **L5 (2026-11-20):** forma real de la API, leída de `https://api.tvmaze.com/singlesearch/shows?q=the+untamed&embed[]=akas&embed[]=seasons`: la serie 42806 trae `type`, `language`, `network` o `webChannel` con `country.code`, `externals.thetvdb` e `imdb`, `image`, `summary` en HTML, `premiered`, `averageRuntime`, `weight` y `updated`. Los alias y las temporadas llegan en `_embedded`.
- **L6 (2026-11-20):** el pronóstico pasa de 400 líneas. Los commits se hacen por unidad de trabajo; la estrategia de cadena (`stacked-to-main` o `feature-branch-chain`) se le pregunta al stakeholder antes de abrir el primer PR. La feature anterior de catálogo usó `feature-branch-chain`.
- **L8 (2026-11-20):** nota del stakeholder para más adelante, fuera del alcance de este issue: «una desición para más adelante es que los Animes y los dramas estén separados en la web. Habr´pa que confirmar si el filtro por eras vale la pena en la sección de dramas». No cambia ninguna spec de la carga.
- **L7 (2026-11-20):** el desarrollo guiado por recibos está apagado (`gentle-ai review mode status`: off, global). No se inician revisiones nativas.
- **L9 (2026-11-20):** T2. RED: 5 pruebas de `src/db/migrations.test.ts` fallan sin la tabla (`42P01`). GREEN: 65 de 65.
- **L10 (2026-11-20):** T3. RED: los tres archivos de prueba de `src/modules/dramas` fallan por módulos inexistentes. GREEN: 44 de 44 junto con las de la carga de anime, que no se tocaron. Los pasos comunes de las dos cargas pasaron a `catalog/services/source-load.ts` y `SourceError` a `catalog/source-error.ts`. `pnpm --filter @acrux/api test`: 556 de 556. `typecheck` y `biome check apps/api`: sin errores.
- **L11 (2026-11-20):** corrida real contra TVmaze y un Postgres 17 local descartable, con el rol `acrux_dramas`. Primera corrida (`--details=60`): 10.550 series, 60 detalles, 8 min 17 s, sin rechazos. Segunda corrida (`--details=0`): 10.550 filas, el mismo hash de IDs y los 60 detalles conservados. Por país: CN 3.810, KR 2.523, JP 2.268; sin país: 1.456 en chino, 339 en coreano y 143 en japonés. Hay títulos repetidos en filas distintas («First Love», 7). «The Untamed» quedó listada; su detalle se comprobó aparte con el cliente: 50 episodios, 1 temporada y los alias «陈情令» y «Chén Qíng Lìng».
- **L12 (2026-11-20):** T4. El workflow usa el entorno `catalog-production` con un secreto nuevo, `DATABASE_URL_DRAMAS`. Pasos manuales pendientes del stakeholder: darle login al rol en Neon y cargar el secreto (`docs/runbooks/dramas.md`).
- **L13 (2026-11-20):** T5, verificador independiente sobre toda la rama. S1 a S6: cumplidas. Sin bloqueos. La migración, aplicada sobre una base con las anteriores y una fila en `anime`, solo agrega permisos y políticas de `drama`. `prisma migrate diff` no encuentra diferencias con el esquema. `loadCatalog` da una salida idéntica a la de `main` en 12 escenarios. `actionlint` pasa sobre `dramas.yml`. Avisos que quedan sin corregir: el texto de la sinopsis solo decodifica siete entidades HTML; una corrida manual de las dos cargas puede coincidir en el tiempo, sobre tablas distintas; una serie con cadena de otro país y plataforma de Corea, Japón o China queda fuera; las series sin país con idioma «Cantonese» o «Mandarin» quedarían fuera.
- **L14 (2026-11-20):** corrección de un aviso del verificador: una fecha de estreno imposible («2019-02-31») o con año anterior a 1900 se guarda sin fecha, para que una fila no detenga la corrida. RED: 2 de 25. GREEN: 25 de 25. `pnpm --filter @acrux/api test`: 560 de 560.
- **L15 (2026-11-20):** el stakeholder eligió «Cadena sobre rama (Recomendado)». Los cuatro commits de trabajo se rearmaron en cinco cortes, sin cambiar el contenido final, porque el commit de T3 tenía 1.150 líneas. Cortes y líneas cambiadas: `feat/carga-tvmaze` (este documento); `-01-tabla` (migración, esquema y pruebas de permisos, 173); `-02-pasos-comunes` (pasos compartidos por las dos cargas, 245); `-03-guardado` (repositorio de dramas, 312); `-04-cliente` (cliente de TVmaze, 429: pasa el límite por 29 líneas porque el cliente va con sus pruebas); `-05-carga` (servicio, comando, workflow y runbook, 342).
- **L16 (2026-11-20):** sobre la puesta en marcha en producción el stakeholder respondió «ejecutalo tu»: el `ALTER ROLE acrux_dramas` en Neon y el secreto `DATABASE_URL_DRAMAS` los ejecuta el agente cuando la migración esté desplegada. La contraseña queda en el historial local de esa sesión.
