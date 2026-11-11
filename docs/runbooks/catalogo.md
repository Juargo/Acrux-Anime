# Catálogo de MyAnimeList

El catálogo vive en la tabla `anime` de Neon y se copia desde la API de MyAnimeList (ADR-0043). El navegador nunca llama a MyAnimeList.

## Qué hay en el código

- **Cliente y conversor:** `apps/api/src/modules/catalog/adapters/myanimelist.ts`. Lee el detalle de un anime, busca por nombre y recorre el ranking por popularidad. El client ID va en la cabecera `X-MAL-CLIENT-ID`. De los 77 valores que MyAnimeList llama géneros guarda 19: los géneros y Ecchi, sin temas ni demografías (lista `GENRES`).
- **Carga por demanda:** `apps/api/src/modules/catalog/services/catalog.service.ts`.
  - Al abrir una franquicia, la API lee de MyAnimeList el detalle de las entradas que no lo tienen, hasta 8 por pedido. El resto vuelve como `pending` y la web lo pide de nuevo.
  - Al buscar un nombre que la tabla no conoce, la API lo busca en MyAnimeList una vez y guarda el resultado.
  - Si MyAnimeList falla, la API responde con lo que hay en la tabla y registra `catalog source failed`. Tras un 403 o un 429 no vuelve a preguntar durante 5 minutos.
- **Trabajo de carga:** `apps/api/scripts/load-catalog.ts`, con la lógica en `services/catalog-loader.ts`. El workflow `.github/workflows/catalog.yml` lo corre los martes a las 07:00 UTC.
  1. Lista todos los animes por popularidad, de a 500 (unos 62 pedidos, cerca de 31.000 animes). Refresca títulos, portada, formato, fecha, géneros y popularidad.
  2. Lee el detalle, con las relaciones, de los animes que no lo tienen, y después de los que lo tienen más viejo. Es un pedido por anime, uno por segundo. No lee detalles de títulos para adultos, videos musicales, PV ni comerciales.
  3. Si MyAnimeList responde 403 o 429, se detiene y el workflow falla. Otro error se reintenta hasta tres veces seguidas.

## Variables

| Variable | Dónde | Para qué |
|---|---|---|
| `MAL_CLIENT_ID` | Proyecto `api` en Vercel (producción y vista previa) | Carga por demanda. Sin ella, la API solo sirve lo que hay en la tabla. |
| `MAL_CLIENT_ID` | Entorno `catalog-production` de GitHub, como secreto | Trabajo de carga. |
| `DATABASE_URL_CATALOG` | Entorno `catalog-production` de GitHub, como secreto | Conexión de Neon con el rol `acrux_catalog`. |

El acuerdo de la API de MyAnimeList prohíbe compartir el client ID: no va en el repositorio, en la web ni en los logs.

## Puesta en marcha (una vez)

1. Desplegar la migración `20261111000000_rol_de_catalogo`. Crea el rol `acrux_catalog` sin login: solo lee, crea y actualiza filas de `anime`.
2. En Neon, rama `production`, darle login y contraseña al rol: `ALTER ROLE acrux_catalog WITH LOGIN PASSWORD '…';`.
3. En GitHub, crear el entorno `catalog-production`, sin revisores y limitado a `main`, con los secretos `MAL_CLIENT_ID` y `DATABASE_URL_CATALOG`.
4. En Vercel, agregar `MAL_CLIENT_ID` al proyecto `api`.
5. Correr el workflow **Catalog** a mano con `details` en `16000`. Tarda unas cuatro horas y media. Repetirlo una vez más: con dos corridas todos los animes que se muestran quedan con su detalle.

Mientras un anime no tiene detalle, el catálogo lo muestra como un ítem suelto, sin agrupar con su saga. Se agrupa cuando el trabajo lo lee o cuando alguien abre su franquicia.

## Operación

- **Corrida semanal:** lista todo y lee 6.000 detalles (cerca de una hora y cuarenta minutos).
- **Corrida a mano:** workflow **Catalog** → *Run workflow*, con el número de detalles.
- **En local:** con `MAL_CLIENT_ID` y `DATABASE_URL` en el entorno, `pnpm --filter @acrux/api catalog:load --details=40`. `--delay` cambia la pausa entre pedidos, en milisegundos (mínimo 500).
- **Si el workflow falla con «stopped early»:** MyAnimeList rechazó o falló. No relanzar enseguida; esperar al menos una hora. Lo ya guardado queda guardado y la próxima corrida sigue desde ahí.

## Comprobación

```sql
SELECT count(*) AS total, count(detailed_at) AS con_detalle,
       count(*) FILTER (WHERE adult) AS adultos, max(fetched_at) AS ultima_lectura
FROM anime;
```

Prueba del 2026-11-11 en una base local: 30.758 animes listados en 2 min 49 s y 40 detalles; una franquicia sin detalle se completó en 1,5 s y la segunda vez respondió en 13 ms.
