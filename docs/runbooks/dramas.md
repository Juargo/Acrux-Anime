# Dramas de TVmaze

Los dramas de acción real viven en la tabla `drama` de Neon y se copian desde la API pública de TVmaze (ADR-0046). El navegador nunca llama a TVmaze. La API de Acrux los sirve solo desde esa tabla, sin llamar a TVmaze, con tres rutas públicas de lectura: `GET /api/v1/dramas` (50 por página, por popularidad; filtros `origin` = `KR`, `JP` o `CN`, y `genres`; `search` busca una parte del título o de un alias sin distinguir mayúsculas, tildes ni marcas de tono), `GET /api/v1/dramas/by-ids?ids=` y `GET /api/v1/dramas/genres`. Nunca devuelve series con el género `Adult`. Una serie sin detalle sale con `aliases` vacío y `seasons` y `episodes` en `null`.

Los datos de TVmaze son CC BY-SA 4.0. Por eso están en una tabla aparte del catálogo de MyAnimeList y de los datos de los usuarios, y la carga usa un rol que solo llega a esa tabla.

## Qué hay en el código

- **Cliente y conversor:** `apps/api/src/modules/dramas/adapters/tvmaze.ts`. No usa API key. Lee una página del índice o el detalle de una serie.
- **Qué series entran** (función `isWanted`):
  - las de tipo `Scripted` cuya cadena o plataforma es de Corea, Japón o China;
  - las de tipo `Scripted` sin país, que salen por plataformas globales, si su idioma es coreano, japonés o chino.

  Una serie de otro país queda fuera aunque esté en uno de esos idiomas.
- **Qué se guarda:** una fila por serie, con el ID de TVmaze como clave. Las temporadas y los episodios son cantidades, no filas. La columna `tvmaze_url` guarda la página de la serie en TVmaze, que es de donde sale el dato y adonde debe apuntar el crédito.
- **Trabajo de carga:** `apps/api/scripts/load-dramas.ts`, con la lógica en `services/drama-loader.ts`. El workflow `.github/workflows/dramas.yml` lo corre los jueves a las 07:00 UTC. La carga de MyAnimeList corre los martes y escribe otra tabla.
  1. Recorre el índice completo de TVmaze, de a 250 IDs por página, porque TVmaze no filtra por país ni por idioma. Guarda título, sinopsis, portada, país, idioma, fecha, géneros, estado, popularidad e IDs de IMDb y TheTVDB.
  2. Lee el detalle de las series que nunca leyó, de la más popular a la menos popular, y después el de las que TVmaze cambió desde la última lectura. Es un pedido por serie. De ahí salen los alias, las temporadas y los episodios.
  3. Si TVmaze responde 403 o 429, se detiene y el workflow falla. Otro error se reintenta hasta tres veces seguidas.
- **Lo que la carga no hace:** no borra series. Una serie que TVmaze quita o cambia de tipo queda en la tabla.

## En la web

- **Ruta:** `/dramas`, con un selector «Anime / Dramas» arriba de Explorar (`apps/web/src/components/ExploreSwitch.tsx`). «Explorar» de la barra queda activo en las dos rutas.
- **Código:** `apps/web/src/dramas/` (pantalla, tarjetas y filtros de país y género) y `apps/web/src/drama-source/` (cliente y consultas contra `/api/v1/dramas`). Es una pantalla aparte: no pide nada a `/api/v1/catalog/*` y el catálogo de anime no pide dramas.
- **Tarjeta:** título internacional, portada, país, año, temporadas y episodios. Lo que la API devuelve en `null` no se muestra.
- **Crédito:** la pantalla de dramas lleva «Datos de TVmaze» con enlace a https://www.tvmaze.com y ningún crédito de MyAnimeList; las de anime siguen con solo el de MyAnimeList.
- **Sin marcas:** los dramas no se marcan ni cuentan en el contador (issue #154).

## Variables

| Variable | Dónde | Para qué |
|---|---|---|
| `DATABASE_URL_DRAMAS` | Entorno `catalog-production` de GitHub, como secreto | Conexión de Neon con el rol `acrux_dramas`. |

TVmaze permite al menos 20 pedidos cada 10 segundos por IP. La carga hace uno cada 600 ms.

## Puesta en marcha (una vez)

1. Desplegar la migración `20261120000000_dramas_de_tvmaze`. Crea la tabla `drama` y el rol `acrux_dramas` sin login: solo lee, crea y actualiza filas de `drama`.
2. En Neon, rama `production`, darle login y contraseña al rol: `ALTER ROLE acrux_dramas WITH LOGIN PASSWORD '…';`.
3. En GitHub, agregar el secreto `DATABASE_URL_DRAMAS` al entorno `catalog-production`.
4. Correr el workflow **Dramas** a mano.

## Operación

- **Primera corrida:** lee el detalle de todas las series. Medido el 2026-11-20 desde una máquina local: 10.550 series, unos 7 minutos de recorrido del índice y cerca de 1 s por detalle. Son unas tres horas, dentro del límite de 12.000 detalles y de las 5 h 30 min del workflow.
- **Corrida semanal:** recorre el índice y lee solo el detalle de las series nuevas o que TVmaze cambió.
- **Corrida a mano:** workflow **Dramas** → *Run workflow*, con el número de detalles.
- **En local:** con `DATABASE_URL` en el entorno, `pnpm --filter @acrux/api dramas:load --details=40`. `--delay` cambia la pausa entre pedidos, en milisegundos (mínimo 500).
- **Si el workflow falla con «stopped early»:** TVmaze rechazó o falló. No relanzar enseguida; esperar al menos una hora. Lo ya guardado queda guardado y la próxima corrida sigue desde ahí.

## Comprobación

```sql
-- Series por país; las que no tienen país se distinguen por idioma.
SELECT coalesce(country, '(sin país)') AS pais, language, count(*)
FROM drama GROUP BY 1, 2 ORDER BY 3 DESC;

-- Series que todavía no tienen alias, temporadas ni episodios.
SELECT count(*) FROM drama WHERE detailed_at IS NULL;

-- «The Untamed»: 50 episodios y los alias «陈情令» y «Chén Qíng Lìng».
SELECT title, episodes, seasons, aliases FROM drama WHERE id = 42806;
```
