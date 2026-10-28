# Requisitos funcionales

Prioridad MoSCoW. **Hito** es el primero en que el requisito debe estar listo (ADR-0031); "—" indica que aún no está asignado. Las pantallas citadas son de Figma (página 05): `Mnn` en celular y `Dnn` en escritorio.

## 1. Cuenta e identidad

| ID | Requisito | Prioridad | Hito | Origen y pantallas |
|---|---|---|---|---|
| RF-01 | El usuario inicia sesión con su cuenta de Google. | Must | H2 | ADR-0015, DD-19 · M01/D01 |
| RF-02 | El usuario puede vincular su cuenta de AniList (opcional; siempre se puede omitir). | Should | — | ADR-0025 · M29–M31 |
| RF-03 | Con AniList vinculada, lo que marca en Acrux se escribe en su lista de AniList, y lo que ya tenía en AniList aparece en Acrux. Al vincular, ambas listas se combinan y gana "Vista". | Should | — | DD-21 · M31 |
| RF-04 | El usuario puede desvincular AniList sin perder su cuenta ni sus marcas; no se borra nada en AniList. | Must (si existe RF-02) | — | Figma flujo 4 · M18/D18 |
| RF-05 | El usuario puede cerrar sesión. | Must | H2 | — |
| RF-06 | El usuario puede borrar su cuenta y todos sus datos. Si la sesión tiene más de 24 horas, debe volver a iniciar sesión antes. Si tiene Plus, se le avisa que la suscripción se cancela sin reembolso proporcional y que el plan vitalicio se pierde. | Must | H2 | ADR-0025, DD-30, DD-33 · M19/D19 |
| RF-07 | El usuario puede editar su nombre visible y su avatar. Se toman de Google y solo se piden si faltan. | Must | H2 | DD-11; Must porque la tarjeta los exige · M06/D06 |
| RF-08 | El usuario puede descargar sus datos personales en JSON en cualquier momento. | Must | H2 | ADR-0028, Ley 21.719 · D35 |
| RF-09 | Antes de crear la cuenta, el usuario declara tener 16 años o más. | Must (propuesta, P-07) | H2 | Figma M01/D01 |

## 2. Catálogo y exploración

| ID | Requisito | Prioridad | Hito | Origen y pantallas |
|---|---|---|---|---|
| RF-10 | La app muestra el catálogo de anime con portada y título; en el primer uso, una carga en ráfaga de las sagas más populares de AniList. | Must | H2 | DD-09 · M02/D02, M03/D03 |
| RF-11 | El catálogo incluye series de TV, películas, OVAs, ONAs y especiales. Se excluye el contenido adulto y las entradas de música. | Must | H2 | ADR-0024, DD-17 |
| RF-12 | El usuario puede buscar por nombre. | Must | H2 | ADR-0017 |
| RF-13 | El usuario puede filtrar por año, género y tipo. | Must | H2 | ADR-0017, ADR-0024 · M34/D36 |
| RF-14 | Cada anime aparece como **un solo ítem por franquicia** que agrupa sus temporadas, películas y demás entradas. | Must | H2 | — |
| RF-15 | Agrupamiento: secuelas y precuelas forman el núcleo; historias paralelas y resúmenes son extras que no cuentan para completar; spin-offs y remakes son franquicias aparte, enlazadas como "relacionadas". Ver RDI-30. | Must | H2 | Figma flujo 2A |
| RF-16 | El detalle de una franquicia muestra sus entradas y cuáles vio el usuario, incluidas las nuevas temporadas. | Must | H2 | M09/D09, M35/D37 |
| RF-17 | Los títulos se muestran en inglés si existen y, si no, en romaji, con opción en Ajustes. | Should | H2 | DD-24 |

## 3. Marcar y contar

| ID | Requisito | Prioridad | Hito | Origen y pantallas |
|---|---|---|---|---|
| RF-20 | Un clic o toque marca una franquicia como **Vista** completa. | Must | H2 | DD-02 |
| RF-21 | El usuario marca una franquicia como **Viendo ahora**. Volver a ver una saga Vista la muestra como "Viendo de nuevo" y sigue sumando. | Must | H2 | DD-15 |
| RF-22 | El usuario puede desmarcar o cambiar el estado de la franquicia o de cada entrada desde el menú de entradas (botón ⋯ en escritorio; toque largo o ⋯ en celular). Si desmarcar resta, el aviso lo indica ("Tu total baja a 47"). | Must | H2 | DD-14, DD-16 · M10/D10 |
| RF-23 | Una franquicia vista se muestra atenuada en el catálogo. | Must | H2 | ADR-0009 |
| RF-24 | Un contador total visible arriba se actualiza al marcar o desmarcar, desde la primera marca. | Must | H2 | — |
| RF-25 | El contador cuenta **por franquicia** por defecto; un ajuste permite contar **por entradas**. | Must | H2 | — |
| RF-26 | Estado de cada saga con prioridad **Viendo > Vista > Parcial > Sin marcar**. Parcial muestra el progreso del núcleo ("3/5 temporadas"). | Should | H2 | Figma flujo 2B |
| RF-27 | El usuario ve su lista de vistos y de viendo ahora, con estado vacío. | Must | H2 | M12/D12, M13/D13 |
| RF-28 | Toda marca se puede deshacer durante 5 segundos desde un aviso; si la escritura en AniList sigue en cola, se cancela. | Must | H2 | Figma flujo 7 · M11/D11 |

## 4. Compartir

| ID | Requisito | Prioridad | Hito | Origen y pantallas |
|---|---|---|---|---|
| RF-30 | El usuario genera una tarjeta vertical 9:16 con su total, nombre, avatar y portadas de lo que está viendo ahora. Justo antes se le pregunta "¿Qué estás viendo ahora?" (se puede saltar). | Must | H2 | DD-10 · M04–M07/D04–D07 |
| RF-31 | La tarjeta se comparte con la hoja del navegador (Web Share API) cuando existe; si no, se descarga la imagen. | Must | H2 | ADR-0026, Figma flujo 1 |
| RF-32 | La tarjeta lleva una marca discreta de Acrux y un enlace o QR al perfil público. | Should | H2 | — |
| RF-33 | La tarjeta básica es gratuita y nunca lleva anuncios. | Must | H2 | RN-05 |
| RF-34 | Hitos automáticos ("¡50 animes!") que invitan a compartir. La lista exacta está por definir. | Could | — | Figma flujo 2B |
| RF-35 | Al compartir la primera tarjeta, se ofrece hacer pública la lista. | Must | H2 | DD-23, ADR-0028 · M08/D08 |

## 5. Perfil público

| ID | Requisito | Prioridad | Hito | Origen y pantallas |
|---|---|---|---|---|
| RF-40 | Cada usuario tiene un perfil público accesible por enlace, sin cuenta, con vista previa para redes (imagen Open Graph). | Must | H2 | ADR-0026 · M14/D14 |
| RF-41 | El perfil público muestra el contador, la lista de vistos y la de viendo ahora. | Must | H2 | — |
| RF-42 | La lista es **privada por defecto**. Si es privada, el enlace no muestra la lista y la API responde `404`. Al pasarla a privada, el visitante deja de verla de inmediato. | Must | H2 | ADR-0028, DD-23 · M15/D15, M17/D17 |
| RF-43 | No existe búsqueda ni listado de perfiles de otros usuarios. | Must | H2 | — |

## 6. Plan Plus

| ID | Requisito | Prioridad | Hito | Origen y pantallas |
|---|---|---|---|---|
| RF-50 | El usuario compra Plus anual o vitalicio con Lemon Squeezy. Sin prueba gratis. | Must | H4 | ADR-0025, DD-27–DD-29 · M21/D21 |
| RF-51 | Plus vive en la cuenta: sigue activo al iniciar sesión en otro navegador o dispositivo. *(Reemplaza "restaurar compra", propio de las tiendas.)* | Must | H4 | Figma flujo 5 |
| RF-52 | Plus desbloquea plantillas y temas extra de tarjeta. Antes de pagar, el usuario prueba el tema en su propia tarjeta con marca de agua. | Must | H4 | Figma flujo 5 · M20/D20 |
| RF-53 | Plus desbloquea estadísticas avanzadas. | Should | H4 | — |
| RF-54 | Plus desbloquea un Wrapped anual compartible. Contenido por definir. | Should | H4 | — |
| RF-55 | Plus desbloquea insignias e íconos. | Could | H4 | — |
| RF-56 | Al vencer o cancelar Plus, el usuario conserva su lista, su total y sus tarjetas. El vitalicio no vence. | Must | H4 | Figma flujo 5 |
| RF-57 | La app informa la confirmación, el error de pago, el pago pendiente (Plus sigue activo 7 días de gracia) y el vencimiento, y muestra el plan en Ajustes. | Must | H4 | M22–M25/D22–D25 |

## 7. Curación

| ID | Requisito | Prioridad | Hito | Origen y pantallas |
|---|---|---|---|---|
| RF-60 | El curador mantiene una tabla de correcciones del agrupamiento para las ~200 sagas más populares, que prevalece sobre el cálculo automático. Una corrección nunca resta al total de nadie. | Must | H2 | R-04, RNF-41, DD-03; Must porque RF-62 y la beta dependen de ella · D34 |
| RF-61 | El curador ve métricas agregadas del producto, sin datos personales. | Could | — | — |
| RF-62 | El usuario reporta una saga mal armada ("Algo no cuadra"); el reporte llega a la cola del curador. Al corregirla, se avisa dentro de la app a quien reportó y a quienes la marcaron. | Should | — | Figma flujo 7, DD-34 · M32/D32, M33/D33, D34 |

## 8. Idioma y apariencia

| ID | Requisito | Prioridad | Hito | Origen |
|---|---|---|---|---|
| RF-70 | La app está en español e inglés y usa el idioma del navegador por defecto. | Must | H2 | ADR-0010 |
| RF-71 | El usuario puede cambiar el idioma. | Should | H2 | — |
| RF-72 | El tema claro u oscuro sigue al sistema, con opción manual. | Should | H2 | DD-25 |
| RF-73 | Los ajustes se guardan al instante, sin botón "Guardar", y se confirman con un mensaje breve. | Must | H2 | Figma flujo 4 · M16/D16 |
| RF-74 | Una pantalla "Acerca de" atribuye el catálogo a AniList. | Must | H2 | ADR-0024 (sin diseño, P-08) |

## 9. Landing de validación

| ID | Requisito | Prioridad | Hito | Origen |
|---|---|---|---|---|
| RF-80 | La landing en `acruxanime.com` muestra la propuesta de valor, mockups de la tarjeta y un botón "Únete a la beta" que registra el correo en la lista de espera, con doble confirmación. | Must | H1 | ADR-0031, ADR-0033 · D40/M40, D41 |
| RF-81 | La landing publica la política de privacidad, el soporte y las instrucciones para borrar la cuenta. | Must | H1 | ADR-0012, RES-34 · D42/M42, D43 |
| RF-82 | La landing y la app piden consentimiento antes de activar la analítica, y permiten retirarlo. | Must | H1 | ADR-0028, ADR-0030 · D40/M40 (falta en la app, P-08) |

## Preguntas abiertas

- RF-02 a RF-04: hito y diseño técnico de la sincronización con AniList (P-03).
- RF-34 y RF-54: lista de hitos y contenido del Wrapped.
- Sagas no lineales (Monogatari, Fate, Gundam): quedan para el curador.
- Orden por defecto del catálogo y de "Mi lista".
