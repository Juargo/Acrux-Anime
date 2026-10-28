# ADR-0029: Estrategia de pruebas (pirámide) y criterios de aceptación en Gherkin

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Amplía las pruebas de ADR-0003 (Playwright de humo) y ADR-0018 (Vitest y Postgres en Docker).

## Contexto

- Una sola persona: las pruebas deben ser rápidas, baratas de mantener y dar confianza para publicar sin revisión manual.
- Las reglas más delicadas son de dominio: agrupamiento de franquicias, contador y permisos del plan (RNF-41, RNF-42).
- El riesgo de seguridad más probable es el acceso a datos de otro usuario, porque Prisma no aplica RLS (ADR-0022).
- Las dependencias externas (AniList, Google, Lemon Squeezy) no se pueden llamar en las pruebas automáticas.

## Opciones consideradas

| Opción | Comentario |
|---|---|
| **Pirámide clásica** con base unitaria grande | Rápida y barata; encaja con un dominio puro (ADR-0019). |
| Trofeo (mayoría de pruebas de integración) | Bueno para apps con poca lógica; Acrux concentra lógica en el dominio. |
| Sobre todo E2E | Lentas, frágiles y caras en minutos de CI. |

Para los criterios de aceptación se consideraron Gherkin y una lista de verificación simple; el stakeholder eligió **Gherkin**.

## Decisión

### Pirámide de pruebas

| Nivel | Proporción aproximada | Qué cubre | Herramientas | Cuándo corre |
|---|---|---|---|---|
| Unitarias | ~70 % | `packages/domain` (franquicias, contador, plan), utilidades y servicios con dobles de prueba | Vitest | Cada PR |
| Integración | ~20 % | Rutas de la API contra Postgres real: validación, autorización, **aislamiento entre usuarios**, transacciones, webhooks con firma | Vitest + Supertest + Postgres en un contenedor | Cada PR |
| Componentes | dentro del 20 % | Pantallas y estados de la SPA (cargando, error, sin conexión, lista vacía) | Vitest + Testing Library | Cada PR |
| Contrato | — | El contrato OpenAPI coincide con el código; pruebas basadas en propiedades sobre el contrato | `openapi:check`, Schemathesis | Cada PR / semanal |
| E2E de humo | ~10 % | Recorridos críticos en viewport de teléfono, con Chromium y WebKit | Playwright | Cada PR, contra la vista previa |

### Reglas

1. **Cobertura mínima del 90 % en `packages/domain`**, verificada en CI. En el resto no hay umbral: se prioriza probar el comportamiento, no las líneas.
2. **Pruebas de aislamiento obligatorias:** por cada ruta `/me/*`, una prueba en la que el usuario B intenta leer o modificar los datos del usuario A y debe fallar.
3. **Sin servicios externos en las pruebas automáticas:**
   - AniList: respuestas fijas en las pruebas de dominio e interceptadas con `page.route()` en Playwright.
   - Supabase Auth: JWT firmados con una clave de prueba (ADR-0018).
   - Lemon Squeezy: cargas de webhook firmadas con un secreto de prueba.
4. **Casos de franquicias reales conocidas** (sagas del top 200) como pruebas de dominio, a partir de la tabla de correcciones del curador (RNF-41).
5. Un error encontrado en producción se corrige primero con una prueba que lo reproduce.

### Criterios de aceptación en Gherkin

- Cada historia de usuario lleva sus escenarios en **Gherkin en español** (`# language: es`: *Característica*, *Escenario*, *Dado*, *Cuando*, *Entonces*), en `docs/criterios/<id-historia>.feature`.
- Cada escenario tiene un identificador (`@CA-RF20-01`) que aparece en el título de la prueba que lo verifica (Playwright, de integración o unitaria), para mantener la trazabilidad.
- **No se usa un ejecutor de Cucumber:** Gherkin es la especificación y las pruebas se escriben en Vitest o Playwright. Así se evita mantener *step definitions*.
- **Definición de terminado:** una historia está terminada cuando todos sus escenarios tienen una prueba en verde, se cumple el pipeline de ADR-0027 y se actualizaron los textos en ambos idiomas.

Ejemplo:

```gherkin
# language: es
@RF-20 @RF-24
Característica: Marcar una franquicia como vista

  @CA-RF20-01
  Escenario: Marcar una franquicia actualiza el contador
    Dado que inicié sesión y mi contador por franquicias está en 12
    Y la franquicia "Shingeki no Kyojin" no está marcada
    Cuando toco "Visto" en la franquicia "Shingeki no Kyojin"
    Entonces el contador muestra 13
    Y todas las entradas del núcleo de la franquicia quedan marcadas como vistas
    Y la franquicia se muestra atenuada en el catálogo

  @CA-RF20-02
  Escenario: Si falla el guardado no se pierde la marca ni se infla el contador
    Dado que inicié sesión y mi contador por franquicias está en 12
    Y la API no responde
    Cuando toco "Visto" en la franquicia "Shingeki no Kyojin"
    Entonces veo un mensaje que indica que no se pudo guardar
    Y el contador vuelve a mostrar 12
```

## Consecuencias

- **Positivas:** la mayor parte de las pruebas corre en segundos; las reglas críticas y el aislamiento entre usuarios tienen cobertura explícita; criterios legibles por el PO y verificables.
- **Negativas / riesgos:** sin un ejecutor de Cucumber, la trazabilidad entre escenario y prueba depende de la convención de identificadores.
- **Acciones derivadas:**
  - Crear `docs/criterios/` con los escenarios de las historias Must.
  - Script de CI que avisa si un `@CA-…` no aparece en ninguna prueba.
