# ADR-0019: Estilo de arquitectura: monolito modular por capas

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Requisitos del 26-oct-2026 (RNF-61, RNF-70, RES-01, RES-03).

## Contexto

Hay que elegir el estilo de arquitectura de Acrux. Las fuerzas son:

- **Una sola persona** desarrolla, opera y mantiene el producto (RES-01, RNF-70).
- **Presupuesto cercano a cero** (RES-03, RNF-61): no se puede pagar infraestructura que no aporte valor al usuario.
- **Carga modesta y predecible:** la meta del estudio a 3 años es de 10.000 a 60.000 usuarios activos al mes. No hay picos en tiempo real ni procesos pesados.
- **Dominio pequeño:** cuenta, perfil, marcas de visto o viendo, franquicias (agrupamiento y curación), perfil público, plan Plus y vínculo con AniList.
- **Integraciones externas:** AniList (catálogo y cuenta opcional, ADR-0024), Supabase Auth (ADR-0025) y Lemon Squeezy (pagos, mediante webhooks).
- ADR-0018 ya definió una API propia en Express, organizada por módulo funcional y **sin Clean Architecture**.

## Opciones consideradas

### Opción A: Monolito modular por capas

Un solo backend desplegable, dividido en módulos funcionales. Cada módulo tiene sus capas (HTTP → servicio → acceso a datos) y comparte un dominio puro sin I/O.

- **Ventajas:** un solo despliegue, un solo pipeline y un solo lugar donde depurar; transacciones ACID locales (ADR-0022); costo cero en la capa gratuita; si algún día hace falta, un módulo se puede extraer como servicio.
- **Desventajas:** escala como un todo (no es un problema con esta carga); sin disciplina, los módulos se acoplan.

### Opción B: Microservicios

- **Ventajas:** despliegue y escalado independientes por servicio.
- **Desventajas:** varios despliegues, contratos entre servicios, consistencia distribuida y observabilidad distribuida, todo para una persona y sin presupuesto. Resuelve problemas de organización (varios equipos) que Acrux no tiene.

### Opción C: Event-driven (broker o colas)

- **Ventajas:** desacople temporal; útil para procesos largos o muchos consumidores.
- **Desventajas:** requiere un broker (un costo o un servicio más que operar), consistencia eventual y depuración más difícil. Los únicos eventos externos (webhooks de Lemon Squeezy) se atienden bien de forma síncrona.

### Opción D: BaaS puro (navegador → Supabase)

Ya descartada en ADR-0018: la lógica queda repartida entre el navegador y las políticas SQL.

## Decisión

**Opción A: monolito modular por capas**, con el monorepo de ADR-0002.

### Capas

```
apps/web (SPA React)            Presentación: pantallas, estado del cliente, consultas a AniList (ADR-0024)
      │  HTTP REST + JWT (ADR-0023, ADR-0025)
apps/api (Express)
  ├─ routes/        HTTP        Validación con Zod, autenticación, traducción de errores
  ├─ services/      Aplicación  Casos de uso; orquestan dominio, repositorios y adaptadores
  ├─ repositories/  Datos       Prisma; toda consulta de datos de usuario recibe el userId
  └─ adapters/      Externos    Supabase Auth (admin), Lemon Squeezy, OAuth de AniList
packages/domain     Dominio     Reglas puras: agrupamiento de franquicias, contador, permisos del plan
packages/shared     Contratos   Esquemas Zod y tipos compartidos entre web y API
```

### Módulos de la API

`account` (cuenta y borrado), `profile` (nombre, avatar, privacidad), `marks` (visto o viendo), `franchises` (tabla de correcciones del curador), `public-profile` (lectura pública), `billing` (Plus y webhooks de Lemon Squeezy) y `anilist-link` (vínculo opcional).

### Reglas

1. Las dependencias van solo hacia abajo: `routes → services → repositories/adapters`, y cualquier capa puede usar `packages/domain`.
2. `packages/domain` no tiene I/O: sin red, base de datos ni framework. Por eso es la parte más fácil de probar (ADR-0029).
3. Una ruta nunca llama a Prisma directamente.
4. Cada módulo es dueño de sus tablas; otro módulo accede a ellas a través de su servicio, no de su repositorio.
5. **Sin broker ni colas.** Los webhooks se procesan de forma síncrona e idempotente (ADR-0023). Si aparece un trabajo diferido (por ejemplo, el Wrapped anual), se usa una tarea programada (Vercel Cron o `pg_cron` de Supabase) antes que un broker.
6. Las reglas 1 a 4 se verifican en CI con `dependency-cruiser` (ADR-0027).

## Consecuencias

- **Positivas:** la menor cantidad posible de piezas que operar; costo cero; las reglas de negocio críticas (franquicias y contador, RNF-41 y RNF-42) quedan concentradas en un paquete puro y probado.
- **Negativas / riesgos:** si se rompen los límites entre módulos, el monolito se vuelve difícil de cambiar. Se mitiga con las reglas verificadas en CI y con este ADR.
- **Acciones derivadas:**
  - Crear `packages/domain` y verificar las reglas de dependencia con `dependency-cruiser` en CI.
  - Actualizar la topología de código de ADR-0004 (ver ADR-0020).

