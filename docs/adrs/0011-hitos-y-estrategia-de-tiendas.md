# ADR-0011: Hitos de publicación y estrategia de tiendas

- **Estado:** Aceptado
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (D5, R2–R4), Reunión 002 (cuentas), Reunión 003 (investigación de Google Play), Reunión 004 (D15–D17)

## Contexto

- El hito original (D5) era tener una build **en revisión en App Store y Google Play antes del 28-oct-2026**, la fecha de término del plan de Claude Max.
- Ambas cuentas de desarrollador existen y son **personales**: Apple Developer, ya pagada, y Google Play Console.
- La cuenta de Google Play se creó en **2026**. Según la [ayuda oficial de Google Play](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), las cuentas personales creadas después del 13-nov-2023 deben correr una **prueba cerrada con al menos 12 testers durante 14 días consecutivos** antes de pedir acceso a producción, y esa revisión suele tardar hasta 7 días.
- Mejor caso: 12 testers dentro el 14-oct → 14 días → 28-oct → solicitud de producción → revisión → **principios de noviembre**. Publicar Android en producción antes del 28-oct **no es alcanzable** (R3 confirmado).

## Decisión

- **Android, hito del 28-oct (D15):** **prueba cerrada activa** con 12 o más testers inscritos y la ficha de la tienda completa. La producción queda para noviembre.
- **iOS, hito del 28-oct (D16):** **app enviada a revisión de App Store**, idealmente también en TestFlight. Meta de envío: **25-oct como máximo**, para dejar colchón por rechazos.
- **Estrategia (D17):** abrir la prueba cerrada de Android **lo antes posible con una versión temprana** y publicar actualizaciones durante los 14 días. Falta verificar que publicar nuevas versiones en la pista de prueba cerrada no reinicie el conteo.

## Consecuencias

- **Positivas:** el hito es alcanzable; el proyecto no cambia, solo el hito de Android.
- **Negativas / riesgos:**
  - **R10:** conseguir 12 testers reales que se mantengan 14 días es la **ruta crítica de Android**.
  - **R11:** si un tester se sale antes de los 14 días, no cuenta. Conviene reclutar entre 15 y 20.
  - **R4:** los tiempos de revisión de las tiendas son impredecibles y pueden incluir rechazos.
- **Acciones derivadas:**
  - **El Sprint 0 cambia de prioridad** (ADR-0001): antes que las funciones, hay que tener la ficha completa de Google Play (descripción, capturas, clasificación de contenido, formulario de seguridad de datos, URL de política de privacidad) y una primera build instalable.
  - Reclutar testers con Android de inmediato (amigos, familia, comunidades de anime, compañeros del máster).
  - Tener temprano el borrado de cuenta y Sign in with Apple (ADR-0007).
  - Publicar la landing con la política de privacidad antes de abrir la prueba cerrada (ADR-0012).

## Preguntas abiertas

- Lista de testers de Android: quiénes y cuándo se pueden inscribir (Reunión 006).
- ¿Publicar nuevas versiones durante la prueba cerrada reinicia el conteo de 14 días?
