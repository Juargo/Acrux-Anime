# Restricciones y riesgos

## Equipo y plazo

| ID | Restricción | Origen |
|---|---|---|
| RES-01 | Un solo desarrollador, que también es el stakeholder. Scrum adaptado con sprints cortos, sin calendario fijo; cada sprint apunta al hito en curso. | ADR-0001, ADR-0031 |
| RES-02 | Sin fecha fija de lanzamiento. La demanda se valida con el producto en producción (lanzamiento directo). | Decisión 26-oct, ADR-0031, ADR-0044 |
| RES-03 | Presupuesto cercano a cero: US$100–200 en anuncios para la landing de validación; infraestructura en capas gratuitas hasta tener ingresos. | Estudio de mercado, ADR-0026 |

## Plataforma

| ID | Restricción | Origen |
|---|---|---|
| RES-10 | **Solo web:** SPA responsive mobile first, instalable como PWA. Sin apps nativas ni tiendas. | ADR-0013, ADR-0016, ADR-0031 |
| RES-11 a RES-15 | *Retirados.* Cuentas de desarrollador, prueba cerrada de Google Play, exigencias de las tiendas, "Iniciar sesión con Apple" y pagos de las tiendas. Dejan de aplicar con RES-10. | ADR-0031 |
| RES-16 | Vercel Hobby es solo para uso no comercial: hay que pasar a Pro antes del primer cobro. | ADR-0020 |

## Términos de uso de la fuente de datos

Desde 2026-11-10 la fuente es MyAnimeList, servida desde el catálogo propio de Acrux (ADR-0043). Las restricciones de AniList quedan tachadas como historial.

| ID | Restricción | Impacto |
|---|---|---|
| RES-20 | ~~AniList prohíbe usar sus datos en trackers competidores no complementarios, salvo que sincronicen de forma sostenida con cuentas de AniList y con autorización previa.~~ **Sin objeto (2026-11-10):** la fuente es MyAnimeList, cuyo soporte respondió que su API se puede usar comercialmente sin licencia (ADR-0041, ADR-0043). | Riesgo R-01 |
| RES-21 | ~~Uso comercial gratuito solo bajo US$150/mes de ingresos; por encima se necesita licencia.~~ **Cambió (2026-11-10):** MyAnimeList no pide licencia, pero el acuerdo de su API prohíbe generar ingresos con una aplicación comercial sin autorización escrita (ADR-0043). | Leer el acuerdo antes de cobrar Plus (R-01) |
| RES-22 | ~~Prohibido usar AniList como almacenamiento o respaldo, y la recolección masiva.~~ **Cambió (2026-11-10):** el catálogo se copia a una tabla propia en Neon (ADR-0043). El acuerdo de MyAnimeList no aclara si se puede guardar el catálogo (R-01). | Carga programada y despacio (R-05) |
| RES-23 | ~~Límite de 90 peticiones por minuto, hoy reducido a 30, sin aumentos.~~ **Cambió (2026-11-10):** el navegador ya no consulta la fuente. MyAnimeList no publica un límite y su soporte avisó que puede restringir el acceso ante pedidos excesivos (ADR-0043). | La carga programada va despacio y se detiene ante un 403 o un 429 |
| RES-24 | ~~"AniList" no puede ir en el nombre de la app; si se menciona, como "for AniList" o "UNOFFICIAL".~~ **Sin objeto (2026-11-10):** ya no se usa AniList. El crédito es «Datos de MyAnimeList» con un enlace (ADR-0043). | Textos y atribución |
| RES-25 | ~~Autorización escrita de AniList antes de publicar.~~ **Cubierto con MyAnimeList (2026-11-10):** autorización por correo de su soporte (2026-11-06), con dos condiciones: crédito con enlace y no cargar su sistema (ADR-0041, ADR-0043). | Requisito previo de H2 |

## Decisiones que restringen el diseño

| ID | Restricción | Origen |
|---|---|---|
| RES-30 | Login solo con Google; ~~vincular AniList es opcional.~~ **El vínculo con AniList sale del alcance del lanzamiento (2026-11-10, ADR-0043, punto 8).** | ADR-0015, ADR-0025 |
| RES-31 | ~~No se almacena el catálogo; solo las marcas de cada usuario.~~ **Cambió (2026-11-10):** el catálogo de MyAnimeList se copia a Neon y la API lo sirve (ADR-0043). | Reunión 006, ADR-0024, ADR-0043 |
| RES-32 | Solo con conexión a internet. | ADR-0013 |
| RES-33 | Exploración por nombre o por año, con filtros de género y tipo. | ADR-0017 |
| RES-34 | La política de privacidad se publica en la landing. | ADR-0012 |
| RES-35 | Stack, despliegue y arquitectura fijados en ADR-0019 a ADR-0030 y ADR-0034 (monolito modular, Vercel en São Paulo + Neon en Ohio, REST con OpenAPI, Prisma). | ADRs |

## Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-01 | ~~Un usuario sin AniList vinculada usa Acrux como tracker independiente con datos de AniList, lo que los términos prohíben sin autorización. AniList podría negar el acceso.~~ **Cambió (2026-11-10, ADR-0043):** la fuente es MyAnimeList y su soporte autorizó el uso comercial de la API por correo (2026-11-06). Queda un riesgo: el texto del acuerdo de la API prohíbe generar ingresos con una aplicación comercial sin autorización escrita y no aclara si se puede guardar el catálogo. | El respaldo es el correo del soporte. Leer el acuerdo (https://myanimelist.net/static/apiagreement.html) antes de cobrar Plus o mostrar anuncios (ADR-0043). |
| R-02 | ~~Costo de la licencia comercial de AniList desconocido.~~ **Sin objeto (2026-11-10):** MyAnimeList no pide licencia (ADR-0041, ADR-0043). | — |
| R-03 | *Retirado.* Prueba cerrada de Google Play. | No aplica (solo web). |
| R-04 | Errores en el agrupamiento de sagas populares. | Tabla del curador (RF-60), reportes (RF-62) y pruebas con sagas reales (ADR-0029). |
| R-05 | ~~MyAnimeList como plan B: por CORS obligaría a volver a un proxy en la API, y migrar exige reescribir el agrupamiento y los IDs guardados.~~ **Ejecutado (2026-11-10, ADR-0043):** MyAnimeList es la fuente. Por CORS se consulta solo desde el servidor, el catálogo vive en una tabla propia y los IDs guardados ya son de MyAnimeList. Falta el cliente de MyAnimeList y el trabajo de carga, que esperan el client ID (`docs/deuda-tecnica.md`). | Crédito «Datos de MyAnimeList» con enlace; carga despacio; detenerse ante un 403 o un 429 (ADR-0043). |
| R-06 | ~~Una ráfaga de 30 sagas populares requiere varias consultas por saga y choca con el límite de 30 por minuto.~~ **Sin objeto (2026-11-10):** el navegador lee el catálogo de la API propia, sin límite de pedidos a la fuente (ADR-0043). | — |
| R-07 | Las portadas del servidor de imágenes de MyAnimeList podrían no servirse con CORS y bloquear la generación de la tarjeta en el navegador (antes, el CDN de AniList). | Confirmarlo con un client ID; si no envía cabeceras CORS, las portadas pasan por la API (ADR-0043). |
| R-08 | Lista privada por defecto puede reducir los perfiles públicos, el motor viral. | Invitación a hacerla pública al compartir (RF-35). |
