# ADR-0031: Validar primero, sin fecha fija, y solo web

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Decisión del 26-oct-2026 (sin fecha fija; primero validar la demanda, RES-02 y RN-04); sesión con el stakeholder, 2026-10-27 («será una app web únicamente por ahora»).

**Reemplaza:**

- ADR-0014 completo: el hito del 28-oct-2026 y su calendario de sprints.
- ADR-0013, en lo referido a la fase futura de apps nativas en Kotlin y Swift. La web responsive mobile first y la ausencia de modo offline siguen vigentes.

## Contexto

- ADR-0014 fijó un hito con fecha (28-oct-2026: web app en producción). El 26-oct-2026 el stakeholder lo dejó sin efecto: **primero se valida la demanda** y no hay fecha fija de lanzamiento (RES-02, RN-04).
- El plan de validación de los Requisitos de Negocio y Usuario define umbrales: entrevistas (≥40 % compartiría la tarjeta), encuesta (≥25 % prefiere el conteo por franquicia; ≥5 % elige una opción de pago), landing de prueba (≥15 % de registro en la lista de espera) y una beta de 30 a 50 testers.
- Publicar requiere la autorización escrita de AniList (RES-25), y cobrar Plus requiere además su licencia comercial (RES-21, R-01, ADR-0024).
- ADR-0013 dejaba abierta una fase futura de apps nativas. El 2026-10-27 el stakeholder decidió que **Acrux será únicamente web por ahora**.

## Opciones consideradas

### Opción A: Mantener un hito con fecha

- **Ventajas:** presión de plazo; fácil de comunicar.
- **Desventajas:** obliga a construir antes de saber si hay demanda; depende de respuestas externas (AniList) que no tienen fecha.

### Opción B: Hitos por umbral (pasar al siguiente solo al cumplir el anterior)

- **Ventajas:** cada inversión de tiempo o dinero se justifica con datos (ADR-0030); compatible con el presupuesto cercano a cero.
- **Desventajas:** sin fecha es más fácil postergar; exige revisar los umbrales con disciplina.

## Decisión

**Opción B**, con estos hitos:

| Hito | Qué se entrega | Condición para pasar al siguiente |
|---|---|---|
| **H1. Validación** | Entrevistas, encuesta y landing de prueba en `acruxanime.com` con lista de espera y medición en PostHog (ADR-0030). Correos de autorización a AniList y MyAnimeList. | Se cumplen los umbrales del plan de validación |
| **H2. Beta cerrada** | Web app en `app.acruxanime.com` para 30 a 50 testers de la lista de espera: login con Google, marcar franquicias, contador, tarjeta, perfil público y borrado de cuenta. **Sin cobro.** | Métricas RN-M1 a RN-M3 medidas y **autorización escrita de AniList** |
| **H3. Lanzamiento público** | Apertura de la web app a todos, en español e inglés. | Licencia comercial de AniList, paso a Vercel Pro (ADR-0020) y Lemon Squeezy configurado |
| **H4. Cobro de Plus** | Plan anual y vitalicio de Plus (ADR-0025). | — |

Si AniList y MyAnimeList responden que no, se detiene el avance después de H1 y se reconsidera el modelo (mitigación de R-01).

### Plataforma: solo web

- Acrux es **únicamente una web app** responsive mobile first, instalable como PWA (ADR-0013, ADR-0016).
- **Las apps nativas salen del plan.** Ninguna decisión de arquitectura se justifica por ellas: el contrato de la API, los paquetes compartidos y la estructura del monorepo se diseñan solo para la web.
- Las cuentas de Apple Developer y Google Play Console no son necesarias para este plan.
- Si en el futuro se retoman las apps nativas, se registra un ADR nuevo.

### Metodología

Sigue vigente el Scrum adaptado a un solo programador de ADR-0001, con sprints cortos de objetivo verificable, pero **sin calendario fijo**: cada sprint apunta al hito en curso.

## Consecuencias

- **Positivas:** no se construye de más antes de saber si hay demanda; el gasto aparece solo cuando hay una condición cumplida; el diseño se simplifica al tener un solo cliente.
- **Negativas / riesgos:**
  - Sin fecha, el proyecto puede alargarse. Se mitiga revisando el avance hacia el hito en cada retrospectiva.
  - Sin app en las tiendas no se cumple RN-01 («publicado en las tiendas»); el portafolio se apoya en la web en producción.
  - Los requisitos del 26-oct-2026 todavía mencionan Android, iPhone, Apple y las tiendas (RN-01, RF-01, RF-50, RF-51, RNF-36, RNF-50, RES-10 a RES-15). Hay que actualizarlos.
- **Acciones derivadas:**
  - Actualizar los requisitos en Obsidian a «solo web» (incluidos login solo con Google y pagos con Lemon Squeezy).
  - Construir la landing de validación (H1) con la lista de espera y el plan de eventos de ADR-0030.
  - Enviar los correos de autorización a AniList y a MyAnimeList.
