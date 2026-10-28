# Criterios de aceptación

Escenarios en Gherkin en español de cada historia de usuario (ADR-0029).

- **Archivo:** `docs/criterios/<id-historia>.feature`, con `# language: es` en la primera línea.
- **Etiquetas:** cada escenario lleva `@CA-<requisito>-<nn>` (por ejemplo, `@CA-RF01-01`), para enlazarlo con su prueba.
- **Sin ejecutor de Cucumber:** Gherkin es la especificación; las pruebas se escriben en Vitest o Playwright y citan la etiqueta del escenario.
