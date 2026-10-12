# ADR-0009: Alcance funcional del MVP

- **Estado:** Aceptado (ítem «versión web fuera del MVP» reemplazado por ADR-0013; filtros sujetos a la validación de la API de MAL, ADR-0008)
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (D1, D4), Reunión 002 (D6), Reunión 003 (D11, D12)

## Contexto

El plazo es de 18 días (R1) y el diferenciador es la simplicidad (D1), así que el alcance debe recortarse al mínimo que demuestre la idea: **saber de forma simple cuántos animes ha visto una persona**.

## Decisión

El MVP incluye **solo** lo siguiente:

1. **Catálogo como una gran lista marcable** de todos los formatos: TV, película, OVA, ONA, especial, etc. (D6).
2. **Búsqueda por nombre.**
3. **Filtros: año, género y tipo. Nada más** (D11).
4. **Marcar como visto:** al marcarlo, el anime se ve en gris y el **contador total** fijo arriba aumenta. El contador cuenta todo lo marcado, sin importar el formato (D6).
5. **Compartir una imagen vertical** con el total de animes vistos, el nombre de usuario y el avatar (D4, D12).
6. **Cuenta de usuario** con Google o Apple, incluido el borrado de cuenta (ADR-0007).
7. **Pantalla «Acerca de»** con la atribución de la fuente del catálogo (ADR-0008).

**Fuera del MVP** (épica E6 o posterior): versión web, compartir la lista completa, enlace público al perfil, modo offline, filtros adicionales (estado de emisión, puntuación, estudio).

## Consecuencias

- **Positivas:** backlog acotado y alineado con el diferenciador.
- **Negativas / riesgos:**
  - Una lista de ~40.000 elementos necesita virtualización y paginación (R6).
  - El filtro de género depende de la lista curada (ADR-0008).
- **Acciones derivadas:**
  - Redactar historias de usuario y criterios de aceptación por épica (E1–E5).
  - Proponer una dirección visual simple, ya que no hay referencias (D19): lista, estado gris al marcar, contador fijo arriba. Se valida en el Sprint 0.
  - Definir el diseño concreto de la imagen para compartir (proporción, por ejemplo 9:16 para historias; tipografía; marca).

## Preguntas abiertas

- ¿Se puede desmarcar un anime? (Se asume que sí, y que el contador baja.)
- Orden por defecto de la lista (alfabético, por año, por popularidad).
