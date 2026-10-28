# ADR-0014: Hito del 28-oct: web app en producción

- **Estado:** Reemplazado por ADR-0031
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-12. Reemplaza a ADR-0011 y a la tabla de calendario de sprints de ADR-0001 (la metodología Scrum adaptada de ADR-0001 sigue vigente).

## Contexto

ADR-0011 definió el hito del 28-oct-2026 en función de las tiendas: prueba cerrada de Android con 12 testers y envío a revisión en App Store. Con el MVP como web app responsive (ADR-0013), esas dependencias dejan de estar en la ruta crítica.

Se mantienen las restricciones de capacidad: ~12 h/día, 18 días desde el inicio (10-oct) y ~216 h (D9). La fecha del 28-oct sigue siendo el término del plan de Claude Max.

## Opciones consideradas

### Opción A: Web app en producción con dominio público y usuarios reales

- **Ventajas:** verificable de forma objetiva; sin dependencias externas de revisión; permite medir el uso real.
- **Desventajas:** exige un dominio público y la configuración de OAuth para web.

### Opción B: Solo una vista previa (*preview*) de Vercel

- **Ventajas:** menos configuración.
- **Desventajas:** no es un lanzamiento; la consola de Google exige una URL de política de privacidad y un dominio de la aplicación para publicar el consentimiento de OAuth.

## Decisión

**Hito del 28-oct-2026:** web app en producción en Vercel, con **dominio público**, utilizable por usuarios reales, con **login con Google vía Supabase Auth (ADR-0015) y borrado de cuenta funcionando**.

Queda **fuera** del hito: publicación en tiendas, prueba cerrada de Google Play y revisión de App Store. Las cuentas de desarrollador (Apple Developer pagada y Google Play Console) se conservan para la fase nativa futura.

Siguen vigentes: sin modo offline (D14, ADR-0013), i18n en español e inglés (ADR-0010) y landing con política de privacidad (ADR-0012), que además es necesaria para la pantalla de consentimiento de Google OAuth.

### Criterios de aceptación del hito

- La app abre en producción desde el dominio público en navegadores móviles y de escritorio.
- Un usuario nuevo puede iniciar sesión con Google, marcar animes, ver el contador y compartir la imagen.
- El usuario puede borrar su cuenta desde la app y se eliminan su usuario y sus marcas (ADR-0007).
- La landing publica la política de privacidad, el soporte y el borrado de cuenta, en español e inglés.

### Calendario de sprints revisado (12 al 28-oct)

Se conserva el ritmo de ADR-0001 (sprints de 2 a 5 días y colchón final de 3 días).

| Sprint | Fechas | Objetivo |
|---|---|---|
| Sprint 0 | 12–13 oct | Setup: monorepo, app web en React, landing en Astro, proyecto Supabase, OAuth de Google para web, registro en la API de MAL y spike de filtros, Edge Function `mal-proxy` con el Client ID como secreto (ADR-0008) y despliegue en Vercel. **Prioridad:** una primera vista previa pública temprana |
| Sprint 1 | 14–17 oct | Login funcional, lista virtualizada del catálogo con búsqueda y filtros (año, género, tipo) |
| Sprint 2 | 18–21 oct | Marcar como visto (gris y contador), imagen para compartir (Web Share API con descarga alternativa), borrado de cuenta |
| Sprint 3 | 22–25 oct | Pulido, política de privacidad en la landing, pantalla «Acerca de», dominio de producción y OAuth publicado |
| Colchón | 26–28 oct | Correcciones, pruebas con usuarios reales y verificación del hito |

## Consecuencias

- **Positivas:** el hito es alcanzable y no depende de revisiones externas; cada sprint termina con una versión desplegada.
- **Negativas / riesgos:**
  - 12 h diarias durante el período siguen siendo difíciles de sostener (R8); el colchón final es la única holgura.
  - La pantalla de consentimiento de Google debe publicarse con la política de privacidad antes de abrirla a usuarios reales.
  - El Sprint 0 pierde un día de margen frente al plan anterior (inicia el 12-oct).
- **Acciones derivadas:**
  - Configurar los proveedores en Supabase con las URLs del dominio de producción y de las vistas previas de Vercel.
  - Adelantar la landing mínima (Sprint 0) para tener una URL de política de privacidad provisional.
  - Redactar la definición de «hecho» del MVP con los criterios de aceptación anteriores.
  - Mantener las cuentas de Apple Developer y Google Play para la fase nativa.

## Preguntas abiertas

- ~~Dominio: ¿dominio propio o `vercel.app`?~~ Resuelto el 2026-10-12: `acruxanime.com` para la landing y `app.acruxanime.com` para la web app (ver ADR-0004, sección «Dominios»).
- ~~¿Se mantiene Sign in with Apple en el MVP web?~~ Resuelto el 2026-10-12: solo Google en el MVP web; Apple con la app iOS (ADR-0015).
- ~~Fuente del catálogo.~~ Resuelto el 2026-10-12: API oficial de MyAnimeList v2 en vivo (ADR-0008).
- Cómo se reclutan los primeros usuarios reales para la última semana.
