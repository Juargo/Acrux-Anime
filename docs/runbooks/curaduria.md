# Curaduría de franquicias

La tabla del curador (`franchise_override`) corrige el agrupamiento automático de las sagas más populares y siempre prevalece sobre él (RF-60, RDI-30). Solo guarda IDs de AniList, sin títulos ni portadas (RDI-15).

## Dar o quitar el rol de curador

La API reconoce a los curadores por su ID de usuario de Neon Auth, que lee de la variable `CURATOR_USER_IDS` (ADR-0034). El usuario no puede cambiársela. El rol de Neon Auth (`neon-auth user set-role`) no sirve para esto: Neon Auth siempre firma `"role": "authenticated"` en el JWT, aunque el usuario tenga otros roles.

1. Busca el ID del usuario en la consola de Neon: **Auth → Users**, en la rama `production`, que es la que usan producción y las vistas previas. También es el `sub` de su JWT.
2. En Vercel, proyecto `app`, edita `CURATOR_USER_IDS` en los entornos **Production** y **Preview**. Contiene los IDs separados por comas. Para quitar un curador, borra su ID.
3. Vuelve a desplegar. La variable se lee al arrancar la API.
4. Comprueba en **Perfil** que aparece la fila **Curaduría**.

## Corregir una franquicia

En **Perfil → Curaduría** (`/curador`):

1. **ID de AniList de la entrada:** la que se corrige. Es el número de su URL en anilist.co.
2. **ID de AniList de la franquicia:** la primera entrada de la saga, la que le da nombre.
3. **Qué es la entrada:**
   - **Núcleo:** cuenta para completar la franquicia.
   - **Extra:** se muestra en la franquicia, pero no cuenta para completarla.
   - **Separada:** es una franquicia propia, relacionada con la indicada.
4. **Guardar corrección.** El enlace **Ver la franquicia** muestra el resultado de inmediato. Al resto de los usuarios les llega en unos cinco minutos, porque la CDN guarda la tabla ese tiempo.

Tocar una corrección de la lista la carga en el formulario para cambiarla.

## Reglas

- **No hay borrado.** Si se borrara una fila, una entrada podría volver al núcleo con su fecha de estreno original y deshacer una franquicia que alguien ya había completado. Para deshacer una corrección, guárdala con otro rol.
- **Una corrección nunca resta.** Una entrada que entra al núcleo cuenta desde el momento de la corrección, así que no deshace franquicias ya completas (RF-60, `packages/domain/src/franchise/progress.ts`).
- **Solo corrige entradas relacionadas en AniList.** La app arma cada franquicia siguiendo las secuelas y precuelas, y una corrección solo se aplica si las dos entradas están en ese conjunto. Las OVA, películas e historias paralelas que AniList ya relaciona con la saga sí se pueden corregir.
- **La API decide.** La pantalla solo se muestra al curador, y además `PUT /api/v1/franchise-overrides/{anilistId}` responde 403 a cualquier sesión sin el rol.

## Carga inicial

RF-60 pide corregir las ~200 sagas más populares. Es trabajo de curaduría, no de código: se hace desde esta pantalla, empezando por las sagas que más marcan los testers de la beta.
