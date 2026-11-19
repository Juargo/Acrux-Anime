# ADR-0045: Exploración por época y por año de estreno de la franquicia

- **Estado:** Aceptado
- **Fecha:** 2026-11-19
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-19, a partir de un prototipo del filtro: «quiero que implementemos esta funcionalidad de filtrado de series». Sobre el número de cada año: «conteo real del catálogo. El conteo será por franquicia si no por el lanzamiento de la temporada. Eso será otra página más adelante. Esta página será excluisva para visualizar los animes por decada de lanzamiento de franquicia.»

**Modifica:** ADR-0017, en lo referido a la exploración por año: qué año se usa, cuántos años se eligen y el año por defecto. La búsqueda por nombre y los filtros de género y tipo de ADR-0017 siguen vigentes.

## Contexto

- ADR-0017 definió la exploración por año como un selector de un solo año, con el año actual por defecto, que muestra los animes estrenados ese año.
- El catálogo muestra un ítem por franquicia (RF-14). Con el año de cada anime, una franquicia antigua aparece en el año de cada temporada nueva, con la portada y el título de su primera entrega.
- Desde ADR-0043 el catálogo es una tabla propia, así que el servidor puede guardar datos calculados de cada anime.
- El stakeholder quiere recorrer el catálogo por época: elegir una época, luego uno o varios años, y ver cuántas franquicias tiene cada año.

## Opciones

### Opción A: mantener el año de cada anime y permitir varios años

- **Ventajas:** no cambia la tabla; el filtro ya existe.
- **Desventajas:** el conteo por año contaría temporadas, no franquicias; una franquicia aparecería en varios años.

### Opción B: usar el año de estreno de la franquicia, guardado en la tabla

- **Ventajas:** cada franquicia aparece en un solo año; el conteo y la grilla coinciden; el filtro y el conteo son consultas simples sobre una columna con índice.
- **Desventajas:** hay que calcular y guardar la franquicia de cada anime; el dato puede atrasarse respecto de las relaciones nuevas.

### Opción C: calcular la franquicia en cada petición

- **Ventajas:** el dato siempre está al día.
- **Desventajas:** agrupar todo el catálogo en cada petición es lento y caro; la paginación no puede apoyarse en un índice.

## Decisión

**Opción B.**

1. **Año de la franquicia.** El año de una franquicia es el año en que empezó la entrada más antigua de su núcleo (secuelas y precuelas, RF-15). Se usa la fecha de inicio y, si falta, el año que informa la fuente. Los extras no cambian ese año.
2. **Dato guardado.** Cada anime guarda la raíz y el año de su franquicia (`franchise_root_id`, `franchise_year`). El cálculo usa el mismo agrupamiento que el navegador (`groupFranchises`, con las correcciones del curador), para que el conteo y la grilla coincidan. Los videos musicales y el contenido adulto quedan sin franquicia.
3. **Cuándo se calcula.** Un paso de recálculo corre al final de cada carga del catálogo (ADR-0043) y también por separado, con su propio script. Solo escribe las filas que cambiaron.
4. **Filtro.** El usuario elige una época y, dentro de ella, uno o varios años; puede combinar años de distintas épocas. Sin años elegidos se ven todos los años; ya no hay un año por defecto. Las épocas son: Pioneros (1917–1959), Era Tezuka (1960–1979), Boom OVA (1980–1994), Edad de oro (1995–2005), Era digital (2006–2014) y Streaming (2015 hasta el año actual, calculado en tiempo de ejecución).
5. **Conteo.** Cada año muestra cuántas franquicias del catálogo se estrenaron ese año. El conteo no depende de los filtros de género y tipo.
6. **API.** `GET /api/v1/catalog/anime` acepta `years` (lista de años de estreno de la franquicia). `GET /api/v1/catalog/franchise-years` entrega el conteo por año. El parámetro `year` (año del anime) se mantiene para los clientes ya desplegados (ADR-0022) y se retirará después.
7. **Búsqueda.** La búsqueda por nombre sigue cubriendo todos los años (ADR-0017); mientras se busca, los años elegidos no se aplican.

## Consecuencias

- Una franquicia aparece en un solo año, el de su primera entrega. Para ver los estrenos de una temporada hará falta otra página, que queda para más adelante.
- Los filtros de género y tipo se siguen aplicando sobre las entradas: una franquicia aparece si alguna de sus entradas cumple el filtro.
- El año de la franquicia puede atrasarse hasta una semana respecto de una relación nueva o de una corrección del curador, porque el recálculo corre con la carga semanal.
- El agrupamiento solo ve los animes cuyo detalle ya se leyó. Una franquicia con entradas sin detalle puede quedar dividida hasta que la carga las lea.
- Los animes sin fecha ni año solo aparecen cuando no hay años elegidos.
- Después de aplicar la migración en producción hay que correr el recálculo una vez; hasta entonces ningún anime tiene año de franquicia.
- El rol de la carga del catálogo necesita leer las correcciones del curador.

## Pendiente

- Retirar el parámetro `year` de la API cuando ningún cliente desplegado lo use.
- Página de estrenos por temporada.
