# Deuda técnica antes del lanzamiento

Todo lo de esta lista debe estar resuelto, o descartado con su motivo, antes del lanzamiento público. Cuando un punto se resuelva, se borra de aquí y se enlaza el PR que lo cerró.

## Plus y cobros (épica #50)

- **Carga de la API key de producción de Lemon Squeezy.** Cargarla sin el prompt interactivo de `vercel env add` y probarla antes de usarla. También evaluar dos cambios:
  - quitar espacios al leer la variable;
  - reportar a Sentry el título del error.

  El detalle está en [`runbooks/plus.md`](./runbooks/plus.md#deuda-técnica-revisar-antes-de-lanzar).
- **Producto en modo real.** Hoy «Acrux Plus» existe solo en modo de prueba, a US$19,99. Falta:
  - crear el producto en modo real, con precio regional para Latinoamérica;
  - crear el webhook de producción;
  - cargar las variables `LEMON_SQUEEZY_*` de producción.
- **Plus en producción solo con la licencia de AniList.** El cobro no se enciende antes de la licencia comercial de AniList: ADR-0036 punto 4, RN-08 y #6.
- **Plus al borrar la cuenta.** Hay dos cosas pendientes:
  - La pantalla de borrado (Figma M19) debe avisar que se pierde Plus y que no se reembolsa solo.
  - El cliente de Lemon Squeezy sigue existiendo después del borrado; hay que definir si se borra y cómo ([`runbooks/borrado-de-cuenta.md`](./runbooks/borrado-de-cuenta.md)).

- **Tema de tarjeta Manga (RF-52).** Hoy hay dos temas: Clásica, que es gratis, y Neón, que es de Plus. Manga aparece en Figma solo como nombre de un chip y no tiene diseño. Falta diseñarlo y agregarlo al enum `card_theme` (decisión del 2026-11-09).
- **Colores de Neón.** Se tomaron a ojo de la vista previa de Figma (M20). Falta revisarlos contra el diseño.

## Anuncios (P-13, ADR-0038)

- **Política de privacidad.** Agregar AdSense como encargado del tratamiento, en español y en inglés. Explicar que fuera de la UE, el Reino Unido y Suiza AdSense deja cookies aunque el usuario no acepte, para frecuencia y fraude.
- **Consentimiento.** Extender el aviso de consentimiento a la publicidad:
  - en la UE, el Reino Unido y Suiza, el CMP de Google con IAB TCF;
  - en el resto, el banner propio (RNF-39).

## Contenido

- **Curaduría de las ~200 sagas más populares.** Revisar con el rol de curador (#42, `/curador`) que cada saga esté bien armada: qué temporadas, películas y OVAs entran y cuáles se separan. La lista de verificación se preparó el 2026-11-08 y la revisión quedó para el final.

## Validación e integraciones

- **#48:** reclutar e invitar a 30–50 testers de la lista de espera.
- **#40 y #41:** vincular y sincronizar la lista de AniList. Están bloqueados por #6, la autorización escrita de AniList.
