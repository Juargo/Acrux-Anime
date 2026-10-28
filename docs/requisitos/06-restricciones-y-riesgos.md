# Restricciones y riesgos

## Equipo y plazo

| ID | Restricción | Origen |
|---|---|---|
| RES-01 | Un solo desarrollador, que también es el stakeholder. Scrum adaptado con sprints cortos, sin calendario fijo; cada sprint apunta al hito en curso. | ADR-0001, ADR-0031 |
| RES-02 | Sin fecha fija de lanzamiento: primero se valida la demanda. | Decisión 26-oct, ADR-0031 |
| RES-03 | Presupuesto cercano a cero: US$100–200 en anuncios para la landing de validación; infraestructura en capas gratuitas hasta tener ingresos. | Estudio de mercado, ADR-0026 |

## Plataforma

| ID | Restricción | Origen |
|---|---|---|
| RES-10 | **Solo web:** SPA responsive mobile first, instalable como PWA. Sin apps nativas ni tiendas. | ADR-0013, ADR-0016, ADR-0031 |
| RES-11 a RES-15 | *Retirados.* Cuentas de desarrollador, prueba cerrada de Google Play, exigencias de las tiendas, "Iniciar sesión con Apple" y pagos de las tiendas. Dejan de aplicar con RES-10. | ADR-0031 |
| RES-16 | Vercel Hobby es solo para uso no comercial: hay que pasar a Pro antes del primer cobro. | ADR-0020 |

## Términos de uso de AniList

| ID | Restricción | Impacto |
|---|---|---|
| RES-20 | AniList prohíbe usar sus datos en trackers competidores no complementarios, salvo que sincronicen de forma sostenida con cuentas de AniList y con autorización previa. | Riesgo R-01 |
| RES-21 | Uso comercial gratuito solo bajo US$150/mes de ingresos; por encima se necesita licencia. | Requisito previo de H3 |
| RES-22 | Prohibido usar AniList como almacenamiento o respaldo, y la recolección masiva. | Sin catálogo propio; caché solo en memoria |
| RES-23 | Límite de 90 peticiones por minuto, hoy reducido a 30, sin aumentos. | Consultas desde el navegador y por lotes |
| RES-24 | "AniList" no puede ir en el nombre de la app; si se menciona, como "for AniList" o "UNOFFICIAL". | Textos y atribución |
| RES-25 | Autorización escrita de AniList antes de publicar. | Requisito previo de H2 |

## Decisiones que restringen el diseño

| ID | Restricción | Origen |
|---|---|---|
| RES-30 | Login solo con Google; vincular AniList es opcional. | ADR-0015, ADR-0025 |
| RES-31 | No se almacena el catálogo; solo las marcas de cada usuario. | Reunión 006, ADR-0024 |
| RES-32 | Solo con conexión a internet. | ADR-0013 |
| RES-33 | Exploración por nombre o por año, con filtros de género y tipo. | ADR-0017 |
| RES-34 | La política de privacidad se publica en la landing. | ADR-0012 |
| RES-35 | Stack, despliegue y arquitectura fijados en ADR-0019 a ADR-0030 y ADR-0034 (monolito modular, Vercel en São Paulo + Neon en Ohio, REST con OpenAPI, Prisma). | ADRs |

## Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R-01 | Un usuario sin AniList vinculada usa Acrux como tracker independiente con datos de AniList, lo que los términos prohíben sin autorización. AniList podría negar el acceso. Ninguna alternativa revisada permite un tracker propio con plan de pago sin autorización. | Pedir autorización a AniList y, en paralelo, a MyAnimeList (plan B). Beta sin cobro. No cobrar Plus sin autorización y licencia. Detenerse tras H1 si ambas responden que no. |
| R-02 | Costo de la licencia comercial de AniList desconocido. | Consultarlo en el correo de autorización. |
| R-03 | *Retirado.* Prueba cerrada de Google Play. | No aplica (solo web). |
| R-04 | Errores en el agrupamiento de sagas populares. | Tabla del curador (RF-60), reportes (RF-62) y pruebas con sagas reales (ADR-0029). |
| R-05 | MyAnimeList como plan B también exige autorización y, por bloquear CORS, obligaría a volver a un proxy en la API. | Pedirla en paralelo; guardar `mal_id` en cada marca. |
| R-06 | Una ráfaga de 30 sagas populares requiere varias consultas por saga y choca con el límite de 30 por minuto. | IDs de las sagas curadas en la base (DD-17), consultas por lotes y caché (P-02). |
| R-07 | Las portadas del CDN de AniList podrían no servirse con CORS y bloquear la generación de la tarjeta en el navegador. | Spike de CORS antes de construir la tarjeta (ADR-0024). |
| R-08 | Lista privada por defecto puede reducir los perfiles públicos, el motor viral. | Invitación a hacerla pública al compartir (RF-35). |
