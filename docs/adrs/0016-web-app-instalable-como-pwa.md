# ADR-0016: Web app instalable como PWA, sin modo offline

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-12. Resuelve la pregunta abierta sobre PWA de ADR-0013.

## Contexto

El MVP es una web app responsive mobile first (ADR-0013). El caso de uso ocurre sobre todo en el teléfono, donde abrir el navegador y escribir la URL agrega fricción frente a un ícono en la pantalla de inicio. El stakeholder además quiere aprender a construir una PWA (*Progressive Web App*) instalable.

Una PWA instalable se apoya en dos piezas:

- **Manifiesto web** (`manifest.webmanifest`): nombre, íconos, colores y modo de visualización (`standalone`), que permiten instalar la app y abrirla sin la barra del navegador.
- **Service worker:** un script que intercepta las peticiones de red y puede guardar archivos en caché. Es la base del modo offline, pero **instalable no implica offline**.

Restricción vigente: **sin modo offline** (D14, ADR-0013).

## Opciones consideradas

### Opción A: Web app sin PWA

- **Ventajas:** nada adicional que construir ni probar.
- **Desventajas:** sin ícono en la pantalla de inicio ni experiencia de pantalla completa; se pierde la oportunidad de aprendizaje.

### Opción B: PWA instalable, con caché solo de los archivos estáticos (*app shell*)

- **Ventajas:** ícono en la pantalla de inicio y apertura en modo `standalone`; la app carga más rápido en visitas siguientes; aprendizaje sobre manifiesto y service workers; base para un modo offline futuro.
- **Desventajas:** el service worker introduce un problema de caché: hay que gestionar las actualizaciones para que los usuarios no queden con una versión vieja; en iOS la instalación es manual («Compartir» → «Agregar a pantalla de inicio»), sin aviso de instalación.

### Opción C: PWA con modo offline completo

- **Ventajas:** la app funciona sin conexión.
- **Desventajas:** requiere base local, sincronización de marcas y resolución de conflictos; contradice D14 y no cabe en el plazo.

## Decisión

**Opción B.** La web app se publica como **PWA instalable**, con **caché solo del *app shell*** (HTML, JS, CSS, íconos y fuentes). **Los datos no se guardan en caché**: el catálogo, las marcas y la sesión siempre se consultan en línea a Supabase. Se mantiene D14: sin conexión, la app muestra el estado «sin conexión» en lugar de datos.

Actualizaciones: cuando hay una versión nueva, la app muestra el aviso **«Hay una nueva versión»** con un botón para recargar; el nuevo service worker solo se activa cuando el usuario lo acepta (`registerType: prompt` en `vite-plugin-pwa`). Así nunca se recarga la página a mitad de una acción.

Implementación propuesta: `vite-plugin-pwa` (genera el manifiesto y el service worker con Workbox), integrado al build de Vite (ADR-0003).

## Consecuencias

- **Positivas:** experiencia cercana a una app nativa sin pasar por las tiendas; arranque más rápido en visitas siguientes; aprendizaje aplicable a la fase nativa y a otros proyectos.
- **Negativas / riesgos:**
  - **Versiones viejas en caché:** si el service worker no se actualiza bien, un usuario puede seguir viendo una versión anterior. Se mitiga con el aviso de nueva versión; hay que probar el flujo de actualización antes del hito.
  - Las peticiones a Supabase y el flujo de OAuth no deben pasar por la caché del service worker.
  - En iOS no hay aviso automático de instalación; conviene explicar en la app o la landing cómo instalarla.
- **Acciones derivadas:**
  - Configurar `vite-plugin-pwa` en `apps/web`: manifiesto bilingüe (nombre y descripción), íconos (incluido ícono *maskable* para Android), `display: standalone`, colores de tema.
  - Excluir de la caché las URLs de Supabase y las rutas de retorno de OAuth.
  - Implementar el aviso de nueva versión y el estado «sin conexión».
  - Verificar la instalación en Android Chrome y en iOS Safari antes del hito (ADR-0014), y revisar el informe de Lighthouse.

## Preguntas abiertas

- ~~Estrategia de actualización: ¿aviso con botón para recargar o actualización automática?~~ Resuelto el 2026-10-12: **aviso con botón para recargar** (ver «Decisión»).
- ¿Se muestra en la web app una sugerencia de instalación (botón en Android, instrucciones en iOS)?
