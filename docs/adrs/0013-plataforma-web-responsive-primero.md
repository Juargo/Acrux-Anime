# ADR-0013: Plataforma prioritaria: web responsive mobile first, sin modo offline

- **Estado:** Aceptado
- **Fecha:** 2026-10-12
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-12. Reemplaza a ADR-0005 y al ítem «versión web fuera del MVP» de ADR-0009.

## Contexto

ADR-0005 fijó el MVP como app móvil nativa (Android e iOS) publicada en las tiendas. Esa ruta depende de tiempos que el equipo no controla (ADR-0011): la prueba cerrada de Google Play exige 12 testers durante 14 días y App Store tiene revisión con posibles rechazos. Con un solo programador y unas 216 h para llegar al 28-oct-2026, el riesgo se concentra en esas dependencias y no en el producto.

El diferenciador sigue siendo la **simplicidad: solo marcar y ver** (D1), y el caso de uso (marcar animes y compartir el total) ocurre sobre todo en el teléfono, que un navegador móvil cubre.

## Opciones consideradas

### Opción A: Web app responsive, mobile first

Una aplicación web diseñada primero para pantallas de teléfono y adaptada a escritorio.

- **Ventajas:**
  - Sin revisión de tiendas ni prueba cerrada de 12 testers: cualquier persona entra con una URL.
  - Un solo código y un solo lenguaje (TypeScript) para app y landing.
  - Despliegue en minutos con Vercel y vista previa pública desde el primer sprint.
  - Cabe en las ~216 h disponibles para un solo programador.
- **Desventajas:**
  - Sin presencia en las tiendas (pieza de portafolio menos vistosa).
  - Acceso limitado a funciones nativas; compartir y notificaciones dependen del navegador.

### Opción B: Apps nativas ahora (Kotlin para Android, Swift para iOS)

- **Ventajas:** mejor experiencia nativa; presencia en las tiendas.
- **Desventajas:** dos bases de código y dos lenguajes; las tiendas vuelven a ser la ruta crítica; inviable en ~216 h.

### Opción C: Multiplataforma (Expo / React Native)

- **Ventajas:** un código para Android e iOS.
- **Desventajas:** mantiene la dependencia de las tiendas y de la prueba cerrada; añade configuración de monorepo, builds y firma; no resuelve el problema de plazo.

## Decisión

- **El MVP es una web app responsive, mobile first** (opción A), pensada para navegadores de teléfono y utilizable también en escritorio.
- **Las apps nativas, Android en Kotlin e iOS en Swift, pasan al futuro** (épica posterior al MVP). No se usan Expo, React Native ni EAS.
- **Se mantiene el modo solo con conexión** (D14, heredado de ADR-0005): la app consulta Supabase directamente, sin base local ni sincronización.
- Se mantiene el diferenciador de simplicidad (D1).

### Requisitos de diseño mobile first

- Objetivos táctiles cómodos (mínimo recomendado de 44×44 px) y sin dependencia de *hover*.
- La lista del catálogo (resultados paginados de la API de MAL, ADR-0008; R6) debe ser fluida en teléfonos de gama media: virtualización y paginación.
- Diseño pensado primero para pantalla vertical de teléfono; escritorio como adaptación.
- Estados claros de carga, error y sin conexión.
- Las funciones que en una app nativa usarían APIs del sistema deben funcionar en el navegador. En particular, la **imagen para compartir** (ADR-0009) se genera en el cliente y se comparte con la Web Share API, con descarga de la imagen como alternativa cuando el navegador no la soporte.

## Consecuencias

- **Positivas:** alcance y plazo controlables; el hito no depende de revisiones externas (ver ADR-0014); iteraciones visibles para usuarios reales sin pasos de publicación.
- **Negativas / riesgos:**
  - Sin conexión la app no sirve (heredado de D14).
  - El soporte de la Web Share API con archivos varía entre navegadores; hay que probar en iOS Safari y Android Chrome.
  - Sin instalación nativa, la retención depende de que la URL sea fácil de recordar o añadir a la pantalla de inicio.
- **Acciones derivadas:**
  - Redefinir el stack y la topología en ADR-0003 y ADR-0004.
  - Reemplazar el hito y el plan de sprints en ADR-0014.
  - Registrar las apps nativas como épica futura; usarán los SDK oficiales de Supabase para Kotlin y Swift (ADR-0006 sigue vigente).

## Preguntas abiertas

- ~~¿Se ofrecerá la web como PWA instalable (manifiesto e ícono), sin modo offline?~~ Resuelto el 2026-10-12: PWA instalable con caché solo del *app shell*, sin modo offline (ADR-0016).
- Navegadores y versiones mínimas soportados.
