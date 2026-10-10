# ADR-0002: Estrategia de repositorio: monorepo

- **Estado:** Propuesto
- **Fecha:** 2026-10-10
- **Participantes:** Jorge Retamal
- **Origen:** Inicio del proyecto

## Contexto

Acrux-Anime probablemente estará compuesto por varias piezas: uno o más clientes (web y, eventualmente, móvil), uno o más servicios de backend, código compartido (tipos, validaciones, cliente de API, componentes de UI), infraestructura y documentación. Hay que decidir si estas piezas viven en un solo repositorio o en varios.

## Opciones consideradas

### Opción A: Monorepo

Un único repositorio con todas las aplicaciones y paquetes, gestionado con *workspaces* y una herramienta de orquestación (por ejemplo, Turborepo o Nx).

- **Ventajas:**
  - Cambios atómicos que cruzan frontend, backend y paquetes compartidos en un solo commit/PR.
  - Código compartido sin publicar paquetes ni versionarlos por separado.
  - Una sola configuración de lint, formato, TypeScript, CI y convenciones.
  - Los ADRs y la documentación viven junto al código que describen.
- **Desventajas:**
  - El CI debe ser selectivo (construir/probar solo lo afectado) para no volverse lento.
  - Requiere configurar herramientas de workspaces y caché.
  - Permisos menos granulares por componente.

### Opción B: Polirepo (un repositorio por componente)

- **Ventajas:** límites claros; despliegues y permisos independientes; repositorios pequeños.
- **Desventajas:** cambios transversales requieren varios PRs coordinados; el código compartido debe publicarse y versionarse; configuración duplicada; sobrecarga alta para un equipo pequeño.

## Decisión

**Pendiente.** La propuesta es adoptar un **monorepo** (Opción A): con un equipo pequeño y un producto en etapa temprana, la velocidad para hacer cambios transversales y la configuración unificada pesan más que la independencia de despliegue.

## Consecuencias (si se acepta)

- **Positivas:** un solo lugar para código, documentación e infraestructura; refactors transversales baratos.
- **Negativas / riesgos:** hay que cuidar los límites entre paquetes para no acoplarlos; el CI necesita caché y ejecución selectiva.
- **Acciones derivadas:**
  - Elegir gestor de paquetes con workspaces y orquestador (ver ADR-0003).
  - Definir la estructura de carpetas (ver ADR-0004).
  - Definir la estrategia de ramas (propuesta: *trunk-based* con ramas cortas y PRs hacia `main`) y la convención de commits (propuesta: Conventional Commits).

## Preguntas abiertas

- ¿Habrá componentes que deban ser open source o tener acceso restringido por separado?
- ¿Orquestador: Turborepo (simple) o Nx (más completo, más complejo)?
- ¿Se versionarán y publicarán paquetes, o todo se consume internamente?
