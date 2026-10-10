# Architecture Decision Records (ADRs)

Cada ADR registra **una** decisión relevante del proyecto: el contexto que la motiva, las opciones evaluadas, la decisión tomada y sus consecuencias.

## Convenciones

- **Nombre de archivo:** `NNNN-titulo-en-kebab-case.md` (numeración correlativa, nunca se reutiliza un número).
- **Plantilla:** [`0000-plantilla.md`](./0000-plantilla.md).
- **Estados:**
  - `Propuesto`: en discusión, todavía no hay decisión.
  - `Aceptado`: decisión vigente.
  - `Rechazado`: se evaluó y se descartó.
  - `Reemplazado por ADR-NNNN`: la decisión dejó de estar vigente.
- Un ADR `Aceptado` no se reescribe. Si la decisión cambia, se crea un ADR nuevo que lo reemplaza y se actualiza el estado del anterior.
- Las secciones *Preguntas abiertas* de los ADRs `Propuesto` deben quedar resueltas antes de pasar a `Aceptado`.

## Índice

| # | Título | Estado | Fecha |
|---|---|---|---|
| [0001](./0001-metodologia-ciclo-de-vida.md) | Metodología de ciclo de vida del desarrollo | Propuesto | 2026-10-10 |
| [0002](./0002-estrategia-de-repositorio-monorepo.md) | Estrategia de repositorio: monorepo | Propuesto | 2026-10-10 |
| [0003](./0003-stack-tecnologico.md) | Stack tecnológico | Propuesto | 2026-10-10 |
| [0004](./0004-topologia-del-proyecto.md) | Topología del proyecto | Propuesto | 2026-10-10 |

## Pendiente: decisiones surgidas en reuniones

Las notas de las reuniones de análisis de requisitos (Obsidian: `Acrux/01 Análisis de Requisitos/Reuniones`) aún no se han incorporado. Cada tema decidido o en discusión en esas reuniones se registrará como un ADR nuevo a partir del `0005`, y los ADRs 0001–0004 se ajustarán si las reuniones ya resolvieron alguna de sus preguntas abiertas.
