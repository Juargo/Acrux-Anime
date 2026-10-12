# ADR-0001: Metodología de ciclo de vida del desarrollo

- **Estado:** Aceptado (plan de sprints reemplazado por ADR-0014)
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (contexto), Reunión 002 (capacidad y calendario)

## Contexto

Acrux es una microapp de portafolio desarrollada por **una sola persona**, que además es stakeholder y Product Owner. Las condiciones son:

- **Plazo muy corto:** hito principal el 28-oct-2026 (ver ADR-0011); quedan 18 días desde el inicio.
- **Capacidad:** unas 12 h/día × 18 días ≈ 216 h (D9).
- **Requisitos** que se levantan en reuniones cortas y siguen cambiando (por ejemplo, la fuente del catálogo se reabrió en la Reunión 005).
- **Dependencias externas** con tiempos que no controla el equipo: revisión de App Store, prueba cerrada de Google Play.

## Opciones consideradas

### Opción A: Cascada

- **Ventajas:** plan cerrado desde el inicio.
- **Desventajas:** el producto se ve tarde; no tolera los cambios que ya están ocurriendo; no permite abrir la prueba cerrada de Android con una versión temprana (D17).

### Opción B: Scrum adaptado a un solo programador

Sprints cortos con objetivo claro, backlog priorizado por el PO, revisión y retrospectiva breves. Sin *daily* ni Scrum Master formales.

- **Ventajas:** hitos frecuentes que se pueden comparar con el plazo; el PO prioriza con información real; encaja con publicar builds tempranas en las tiendas.
- **Desventajas:** las ceremonias deben ser mínimas para no consumir horas; con una persona en todos los roles, cuesta mantener disciplina en la priorización.

### Opción C: Kanban puro

- **Ventajas:** mínima sobrecarga.
- **Desventajas:** sin hitos naturales, en un plazo de 18 días es fácil perder de vista si se llega o no.

## Decisión

Se adopta **Agile/Scrum adaptado a un solo programador** (Opción B), como se definió en la Reunión 001:

- **Roles:** Jorge es PO y equipo de desarrollo; Claude actúa como analista (levantamiento de requisitos, investigación, propuestas).
- **Sprints cortos (2 a 5 días)** con un objetivo verificable cada uno.
- **Reuniones de requisitos numeradas** (001, 002, …), con decisiones (`Dn`), supuestos (`Sn`) y riesgos (`Rn`) trazables. Las decisiones de arquitectura y proceso se registran como ADR en este directorio.
- **Planificación con colchón:** no se planifica al 100 % de la capacidad (riesgo R8, fatiga).
- **Backlog por épicas** (E1–E6, Reunión 001), que se descompone en historias de usuario con criterios de aceptación.

### Calendario (borrador de la Reunión 002, ajustado por la Reunión 004)

| Sprint | Fechas | Objetivo |
|---|---|---|
| Sprint 0 | 10–11 oct | Setup: repo, Expo, Supabase, OAuth Google/Apple, EAS, siembra del catálogo. **Prioridad:** ficha completa de Google Play y una primera build instalable para abrir la prueba cerrada |
| Sprint 1 | 12–16 oct | Login, lista del catálogo con búsqueda y filtros |
| Sprint 2 | 17–21 oct | Marcar como visto (gris + contador), imagen para compartir |
| Sprint 3 | 22–25 oct | Pulido, ícono, capturas, política de privacidad, envío a App Store (máximo 25-oct) |
| Colchón | 26–28 oct | Respuesta a rechazos o correcciones |

## Consecuencias

- **Positivas:** cada sprint termina con algo instalable, lo que permite publicar actualizaciones durante la prueba cerrada de Android (D17).
- **Negativas / riesgos:** 12 h diarias durante 18 días es un ritmo difícil de sostener (R8); el colchón final es la única holgura.
- **Acciones derivadas:**
  - Redactar historias de usuario y criterios de aceptación del Sprint 0 y Sprint 1 (pendiente de las reuniones 003–005).
  - Acordar la definición de «hecho» del MVP.
  - Elegir la herramienta para el backlog (GitHub Projects, Obsidian u otra).

## Preguntas abiertas

- Definición de «hecho» (pendiente de la Reunión 006).
- Herramienta para el tablero y el backlog.
