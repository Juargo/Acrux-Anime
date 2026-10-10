# ADR-0001: Metodología de ciclo de vida del desarrollo

- **Estado:** Propuesto
- **Fecha:** 2026-10-10
- **Participantes:** Jorge Retamal
- **Origen:** Inicio del proyecto

## Contexto

Acrux-Anime arranca desde cero, con un equipo reducido (posiblemente una sola persona en el inicio) y requisitos que todavía se están levantando en la fase de *Análisis de Requisitos*. Se necesita una forma de trabajo que:

- Permita entregar valor de forma incremental y validar pronto con usuarios reales.
- Tolere requisitos cambiantes, propios de un producto nuevo.
- No imponga ceremonias pesadas que un equipo pequeño no puede sostener.
- Deje trazabilidad: qué se decidió, qué se construyó y por qué.

## Opciones consideradas

### Opción A: Cascada (Waterfall)

Fases secuenciales: requisitos → diseño → implementación → pruebas → despliegue.

- **Ventajas:** planificación clara; documentación completa desde el inicio.
- **Desventajas:** poca tolerancia al cambio; el usuario ve el producto muy tarde; riesgo alto si los requisitos iniciales son incorrectos.

### Opción B: Scrum

Sprints de duración fija (1–2 semanas) con *planning*, *daily*, *review* y *retrospectiva*; roles definidos (PO, SM, equipo).

- **Ventajas:** ritmo predecible; inspección y adaptación frecuentes; muy conocido.
- **Desventajas:** los roles y ceremonias pesan demasiado con un equipo de 1–2 personas; los sprints fijos pueden ser artificiales en un proyecto personal con disponibilidad variable.

### Opción C: Kanban

Flujo continuo con tablero (Backlog → En progreso → Revisión → Hecho) y límites de trabajo en curso (WIP).

- **Ventajas:** mínima sobrecarga; se adapta a disponibilidad irregular; hace visibles los cuellos de botella.
- **Desventajas:** sin hitos naturales, cuesta medir avance y fijar metas; requiere disciplina para priorizar.

### Opción D: Híbrido iterativo-incremental (Scrumban liviano)

Kanban como flujo diario + iteraciones con un objetivo claro (por ejemplo, ciclos de 2 semanas que cierran con una versión utilizable), revisión y retrospectiva breves al cierre de cada ciclo. Fases de alto nivel inspiradas en un ciclo iterativo: análisis → diseño → construcción → validación, repetidas por incremento.

- **Ventajas:** combina la baja sobrecarga de Kanban con hitos y metas de Scrum; encaja con la fase de análisis de requisitos ya en curso.
- **Desventajas:** al ser una mezcla, hay que acordar explícitamente las reglas para que no derive en “sin proceso”.

## Decisión

**Pendiente.** La propuesta inicial es la **Opción D (híbrido iterativo-incremental)**, a confirmar con lo conversado en las reuniones de análisis de requisitos.

## Consecuencias (si se acepta la Opción D)

- **Positivas:** entregas frecuentes y validables; proceso sostenible con un equipo pequeño.
- **Negativas / riesgos:** requiere mantener actualizado el tablero y el backlog; riesgo de alcance que crece sin control si no se fija el objetivo de cada ciclo.
- **Acciones derivadas:**
  - Definir el tablero (GitHub Projects u otra herramienta) y sus columnas.
  - Definir la *Definition of Done* (código revisado, pruebas, documentación, desplegado).
  - Definir la estrategia de ramas y versionado (ver ADR-0002).

## Preguntas abiertas

- ¿Cuántas personas participarán y con qué dedicación?
- ¿Duración de los ciclos (1, 2 o 3 semanas)?
- ¿Qué herramienta para el tablero y el backlog (GitHub Projects, Linear, Notion, Obsidian)?
- ¿Cómo se registrarán los requisitos (historias de usuario, casos de uso)?
