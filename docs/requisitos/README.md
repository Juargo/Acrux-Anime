# Requisitos de Acrux

Destilación de los requisitos vigentes de Acrux a partir de tres fuentes:

| Fuente | Contenido | Fecha |
|---|---|---|
| Obsidian (`Acrux - ANIME/Requisitos`) | Requisitos de negocio, usuarios, funcionales, no funcionales, datos y restricciones; reuniones 001–006 | 2026-10-26 |
| Figma ([Acrux · Diseño de producto](https://www.figma.com/design/O92G2cpxm6XauGu9nqe7zL)) | Flujos (páginas 04) con las decisiones de diseño `DD-nn`, y pantallas de celular y escritorio (página 05) | 2026-10-26 |
| [ADRs](../adrs/README.md) | Decisiones de arquitectura, en especial ADR-0019 a ADR-0031 | 2026-10-27 |

## Regla de precedencia

Cuando las fuentes se contradicen, gana la decisión más reciente: **ADR aceptado > decisión de diseño `DD-nn` de Figma > nota de Obsidian**. Cada requisito modificado indica su origen. Los conflictos que no se pueden resolver así quedan en [Pendientes](#pendientes-antes-del-primer-sprint).

## Documentos

| # | Documento | Prefijo de IDs |
|---|---|---|
| 1 | [Negocio y usuario](./01-negocio-y-usuario.md) | `RN`, `RN-M`, `RU` |
| 2 | [Usuarios, roles y permisos](./02-usuarios-y-roles.md) | — |
| 3 | [Requisitos funcionales](./03-funcionales.md) | `RF` |
| 4 | [Requisitos no funcionales](./04-no-funcionales.md) | `RNF` |
| 5 | [Datos e integración](./05-datos-e-integracion.md) | `RDI` |
| 6 | [Restricciones y riesgos](./06-restricciones-y-riesgos.md) | `RES`, `R` |

## Convenciones

- Se conservan los IDs de Obsidian para mantener la trazabilidad. Un ID eliminado no se reutiliza; se marca como **Retirado** con su motivo.
- Prioridad MoSCoW. **Hito** indica el primero en que el requisito debe estar listo (H1 a H4, ADR-0031).
- Los criterios de aceptación de cada historia se escriben en Gherkin en `docs/criterios/` (ADR-0029).

## Cambios respecto de Obsidian (26-oct)

| Cambio | Origen |
|---|---|
| Solo web (SPA responsive mobile first, instalable como PWA); se retiran Android, iPhone y tiendas | ADR-0013, ADR-0016, ADR-0031 |
| Inicio de sesión solo con Google; Apple se retira | ADR-0015, ADR-0025, DD-19 |
| Plus con Lemon Squeezy: solo anual y vitalicio, sin prueba gratis; "Plus vive en la cuenta" reemplaza "restaurar compra" | ADR-0025, DD-27, DD-28, DD-29 |
| La identidad es la cuenta de Google; AniList es un vínculo opcional | ADR-0025 |
| Lista privada por defecto; se ofrece hacerla pública al compartir la primera tarjeta | ADR-0028, DD-23 |
| Nuevos RF-08 (descargar mis datos), RF-09 (edad), RF-17 (idioma de los títulos), RF-28 (deshacer), RF-35 (ofrecer lista pública), RF-57 (estados del pago), RF-62 (reportar saga), RF-72 a RF-74 (tema, guardado instantáneo, Acerca de) y RF-80 a RF-82 (landing de validación) | ADR-0024, ADR-0028, ADR-0031, Figma flujos 1 a 7, DD-23 a DD-25 |
| RF-04, RF-07 y RF-60 pasan a Must; RF-02, RF-03 y RU-02 pasan a Should (el vínculo con AniList no entra en H2) | Figma flujos 1, 4 y 7; ADR-0031 |
| Marco legal: Ley 21.719 y GDPR básico | ADR-0028 |
| Hitos por umbral, sin fecha fija | ADR-0031 |

## Pendientes antes del primer sprint

Conflictos y vacíos detectados en la revisión del 2026-10-27. Ningún pendiente bloquea H1; quedan por completar los textos entre corchetes de la política de privacidad y del soporte.

| ID | Pendiente | Fuentes en conflicto | Bloquea |
|---|---|---|---|
| P-01 | ~~Landing de validación sin diseño.~~ **Resuelto (2026-10-27):** D40–D43 y M40, M42 en Figma (secciones "H1. Landing de validación"), con los componentes "Formulario · Lista de espera" y "Aviso de consentimiento". Quedan textos entre corchetes por completar: responsable, correos de contacto y soporte, y plazo de respuesta. | ADR-0031 (H1), ADR-0030 | — |
| P-02 | **Caché del catálogo.** Figma fija 7 días de caché en el navegador; ADR-0024 permite solo caché en memoria, sin persistencia. | DD-17 vs ADR-0024 regla 1 | H2 |
| P-03 | **Sincronización con AniList sin decisión técnica.** El token se guarda cifrado en la API (ADR-0025), así que las escrituras saldrían desde el servidor y compartirían un único límite de 30 peticiones por minuto, el problema que ADR-0024 descartó. Falta decidir dónde corre la cola de escrituras (DD-17), la lectura inicial y la resolución de conflictos. | ADR-0024, ADR-0025, DD-17, RDI-33 | Vínculo con AniList (fuera de H2) |
| P-04 | ~~Retención de los respaldos.~~ **Resuelto (2026-10-27):** 30 días (ADR-0032). | DD-32, ADR-0032 | — |
| P-05 | **Cancelar la suscripción al borrar la cuenta** no está en el borrado de ADR-0025 (falta la llamada a Lemon Squeezy). | DD-30 vs ADR-0025 | H4 |
| P-06 | **ADR-0009 y ADR-0017 desactualizados.** ADR-0009 sigue diciendo que el contador cuenta entradas y que el login es con Google o Apple; ADR-0017 limita la exploración a nombre o año por las restricciones de MAL, pero la carga en ráfaga muestra las sagas más populares de AniList (DD-09). Falta un ADR que los reemplace. | ADR-0009, ADR-0017 vs RF-25, DD-09, ADR-0024 | Coherencia documental |
| P-07 | **Requisito de edad.** La landing de Figma pide "Tengo 16 años o más"; ningún requisito ni ADR lo define. Se recoge como RF-09 (propuesta). | Figma D01/M01 | H2 |
| P-08 | **Pantallas sin diseño:** "Acerca de" con la atribución a AniList (ADR-0024), aviso de consentimiento dentro de la app (el de la landing ya existe), celebración de hito (RF-34) y aviso de sincronización pendiente. Falta también el flujo 3 (compartir y perfil público) en la página de flujos. | ADR-0024, ADR-0028 vs Figma | H2 |
| P-09 | **Autorización de AniList y MyAnimeList:** correos pendientes de envío. | ADR-0024, ADR-0031 | H2 |
| P-10 | **Almacén del límite de peticiones de la API** sin elegir (Upstash Redis o firewall de Vercel). | ADR-0028 | H2 |
| P-11 | **Requisitos de Obsidian sin actualizar** a "solo web" (acción derivada de ADR-0031). Este directorio pasa a ser la fuente vigente. | ADR-0031 | — |
| P-12 | ~~Lista de espera sin modelar.~~ **Resuelto (2026-10-27):** Buttondown con doble confirmación (ADR-0033). Sigue abierta la tabla de reportes de sagas (RDI-18), que no bloquea H1. | ADR-0022, ADR-0033 | — |
