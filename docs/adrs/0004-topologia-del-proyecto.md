# ADR-0004: Topología del proyecto

- **Estado:** Propuesto
- **Fecha:** 2026-10-10
- **Participantes:** Jorge Retamal
- **Origen:** Inicio del proyecto

## Contexto

Con un monorepo (ADR-0002) y un stack aún en discusión (ADR-0003), hay que definir dos aspectos de la topología:

1. **Topología de código:** cómo se organizan aplicaciones y paquetes dentro del repositorio, y qué dependencias se permiten entre ellos.
2. **Topología de despliegue:** qué componentes se ejecutan, dónde y cómo se comunican.

## Topología de código

### Estructura propuesta

```
acrux-anime/
├── apps/
│   ├── web/            # Cliente web
│   ├── mobile/         # Cliente móvil (si aplica)
│   └── api/            # Backend / API
├── packages/
│   ├── domain/         # Entidades, tipos y reglas de negocio puras
│   ├── ui/             # Componentes de interfaz compartidos
│   ├── api-client/     # Cliente tipado para consumir la API
│   ├── config/         # Configuración compartida (tsconfig, eslint, prettier)
│   └── utils/          # Utilidades genéricas
├── infra/              # Infraestructura como código, docker-compose, scripts
├── docs/
│   └── adrs/           # Este registro de decisiones
└── .github/workflows/  # CI/CD
```

### Reglas de dependencia propuestas

- `apps/*` pueden depender de `packages/*`; **nunca** una app depende de otra app.
- `packages/domain` no depende de ningún framework (ni React, ni Next, ni ORM).
- `packages/ui` solo lo consumen los clientes, nunca `apps/api`.
- Las dependencias circulares entre paquetes están prohibidas (verificable con el orquestador o con reglas de lint).

## Topología de despliegue

### Opción A: Monolito modular

Una sola aplicación desplegable (por ejemplo, Next.js con rutas de API) organizada internamente en módulos.

- **Ventajas:** un solo despliegue; operación mínima; ideal para un MVP.
- **Desventajas:** frontend y backend escalan y se despliegan juntos; acoplamiento si no se cuidan los módulos.

### Opción B: Cliente(s) + API separada

`apps/web` (y `apps/mobile`) consumen `apps/api` vía HTTP (REST o GraphQL); base de datos gestionada; almacenamiento de objetos + CDN para imágenes.

- **Ventajas:** una sola API para web y móvil; despliegue y escalado independientes; límites claros.
- **Desventajas:** dos despliegues; hay que gestionar CORS, autenticación entre servicios y versionado de la API.

### Opción C: Microservicios

Varios servicios por dominio (catálogo, usuarios, recomendaciones, etc.).

- **Ventajas:** escalado y despliegue por dominio.
- **Desventajas:** complejidad operativa desproporcionada para la etapa actual.

### Diagrama de la opción B (referencia)

```
 [Navegador] ──► apps/web (Next.js, CDN/Edge)
                      │
 [App móvil] ─────────┼──► apps/api ──► PostgreSQL (gestionado)
                      │        │
                      │        ├──► Storage de imágenes + CDN
                      │        └──► APIs externas de anime (caché)
```

## Decisión

**Pendiente.** Propuesta:

- **Código:** adoptar la estructura `apps/` + `packages/` con las reglas de dependencia indicadas.
- **Despliegue:** comenzar con un **monolito modular** (Opción A) si el MVP es solo web, o con **Opción B** si la app móvil forma parte del alcance inicial. En ambos casos, separar el dominio en `packages/domain` para que migrar de A a B sea barato.

## Consecuencias (si se acepta)

- **Positivas:** límites claros desde el día uno; camino de evolución gradual sin reescrituras.
- **Negativas / riesgos:** algo de estructura “por adelantado” que puede parecer excesiva en las primeras semanas.
- **Acciones derivadas:** crear el esqueleto de carpetas; configurar las reglas de dependencia en lint/CI; documentar entornos (local, *staging*, producción).

## Preguntas abiertas

- ¿El alcance del MVP incluye móvil? (determina la opción A o B)
- ¿REST o GraphQL para la API?
- ¿Cuántos entornos se mantendrán (local, *staging*, producción)?
- ¿Desarrollo local con Docker Compose (base de datos, storage) o servicios en la nube?
