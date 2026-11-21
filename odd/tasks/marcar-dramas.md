# Marcar dramas como vistos (issue #154)

Objetivo: una persona marca y desmarca un drama desde su tarjeta, la marca persiste entre dispositivos y se borra con la cuenta, sin tocar las marcas de anime. Rama de integración `feat/154-marcar-dramas`. Entrega: `ask-on-risk`, cadena `feature-branch-chain` (la elegida en las dos funciones anteriores; previsión de unas 900 líneas). Pruebas: `pnpm --filter @acrux/api test` y `pnpm --filter @acrux/web test` (Vitest; la API usa Testcontainers y necesita Docker), `pnpm --filter @acrux/e2e test` (Playwright).

## Specs

- **S1.** Pedido del stakeholder (2026-11-20): «sigamos con #154».
- **S2.** Qué se marca. El stakeholder respondió «si, la serie entera» a «¿Vamos con la serie entera?». La opción, tal como se le presentó: «la serie entera, con los mismos dos estados que el anime (visto / viendo)». Costo aceptado: «en un drama de varias temporadas no vas a poder decir «vi la 1 y no la 2»; quedará como «viendo»».
- **S3.** Contador. El stakeholder respondió «si, dos números separados» a «¿Vamos con dos números separados?». La opción: «el contador de anime queda tal cual y los dramas tienen el suyo, visible en la sección de dramas». Incluye: «hoy el encabezado muestra «0 animes» en `/dramas`. Ahí pasaría a decir «N dramas»».
- **S4.** Dónde aparecen. El stakeholder respondió «si, ninguna de las cuatro» a «¿Vamos con ninguna de las cuatro, o querés sumar el filtro «Mis dramas» en este issue?». La opción: «En este issue los dramas se marcan y se ven solo dentro de la sección de dramas: estado en cada tarjeta y el contador «N dramas»». Quedan fuera Mi lista, la tarjeta para compartir, las estadísticas y las insignias. Costo aceptado: «no vas a tener dónde ver «todos mis dramas marcados» juntos».
- **S5.** Tareas del issue #154:
  - «Guardar marcas de dramas sin romper las marcas de anime que ya existen»
  - «Marcar y desmarcar un drama desde su tarjeta»
- **S6.** Criterios de aceptación del issue #154:
  - «Las marcas de anime existentes quedan intactas»
  - «Un drama marcado sigue marcado al volver a entrar y en otro dispositivo»
  - «Borrar la cuenta borra también las marcas de dramas»
- **S7.** Fuera de alcance (issue #154): «Marcar episodios sueltos».
- **S8.** Supuesto, no pedido: la exportación de datos de la cuenta incluye las marcas de dramas, porque ADR-0028 pide exportar todo lo que Acrux guarda de la persona.
- **S9.** Supuesto, no pedido: las marcas de dramas van en una tabla propia, `drama_mark`, y la tabla `mark` no cambia. Es la forma de cumplir «Las marcas de anime existentes quedan intactas» sin migrar datos existentes.

## Tasks

- [x] **T1** (S2, S5, S6, S8, S9) API y datos: tabla `drama_mark` con sus permisos, rutas para listar, marcar y desmarcar, exportación de la cuenta. Ruta: en línea (sin motivo para un escritor: la parte web depende de este contrato). Riesgo: ítems 1 y 2 (migración, permisos y RLS), con verificador independiente. Commit: `ef541aa`, rama `feat/154-marcas-api`.
- [x] **T2** (S2, S3, S4, S5, S6) Web: marcar y desmarcar desde la tarjeta, estado en cada tarjeta, contador «N dramas» en la sección, textos en español e inglés, prueba de punta a punta. Ruta: en línea. Riesgo: ninguno. Commit: rama `feat/154-marcas-web`.

## Log

- **L1.** Pedido original del stakeholder (2026-11-20): «sigamos con #154».
- **L2.** (2026-11-20) Las tres «Definiciones previas» del issue se resolvieron una por una con el stakeholder; sus respuestas textuales están en S2, S3 y S4.
- **L3.** (2026-11-20) Análisis. Las marcas de anime viven en `mark`, con clave `(user_id, anime_id)` y borrado en cascada desde `profile`. La tabla `drama` tiene una fila por serie y el trabajo de carga nunca borra dramas. De ahí S9: tabla aparte con la misma forma, clave `(user_id, drama_id)`, cascada desde `profile` y referencia a `drama`.
- **L4.** (2026-11-20) Previsión de entrega: T1 unas 450 líneas, T2 unas 450. Pasa de 400, así que va en cadena: cada tarea es un PR hijo contra la rama de integración.
- **L5.** (2026-11-20) T1 hecho. RED visto antes de implementar (faltaban la tabla y el módulo). `pnpm --filter @acrux/api test`: 635 de 635. El esquema de Prisma coincide con las migraciones (`prisma migrate diff`, sin diferencias). Rutas: `GET /api/v1/me/drama-marks`, `PUT` y `DELETE /api/v1/me/drama-marks/:dramaId`; marcar un drama que no está en la tabla responde 404 y no escribe nada. La exportación suma el campo `dramaMarks`.
- **L6.** (2026-11-20) Verificador independiente sobre `ef541aa`, en una copia aparte: sin bloqueos; S2, S5, S6, S8 y S9 cumplidos. Comprobó que la migración deja idénticas las filas de `mark`, los permisos por rol, el aislamiento entre personas y 12 escrituras simultáneas en una sola fila. Avisos: marcar un drama inexistente crea igual el perfil (el anime hace lo mismo desde antes); la migración toma un bloqueo breve sobre `profile` y `drama`, así que conviene desplegar fuera de una carga de dramas; volver atrás es un `DROP TABLE drama_mark` manual. No verificado: el comportamiento real en Neon.
- **L7.** (2026-11-20) RDD está apagado (decisión global del stakeholder): no se abrió revisión nativa. La evaluación nativa de `ef541aa` dio riesgo alto.
- **L8.** (2026-11-20) T2 hecho. RED visto antes de implementar. Decisión de interfaz, no consultada: como los dramas no tienen pantalla de detalle, la tarjeta lleva dos botones, ✓ (visto) y ▶ (viendo); el botón activo quita la marca y el otro la reemplaza. En `/dramas` el encabezado muestra «N dramas / vistos» en lugar del contador de anime; «viendo» no cuenta. Se cambió una prueba del #151 que afirmaba que los dramas no se marcan. `pnpm --filter @acrux/web test`: 486 de 486. E2E `tests/dramas.spec.ts` en Chromium: 5 de 5, con los dramas de prueba escritos en la tabla desde `support/start-api.ts`. Pendiente: E2E en WebKit (lo corre el CI) y ver las tarjetas en un navegador real.
