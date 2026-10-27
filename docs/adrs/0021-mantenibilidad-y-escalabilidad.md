# ADR-0021: Mantenibilidad y escalabilidad

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Requisitos RNF-60, RNF-61, RNF-70 y RNF-71.

## Contexto

Acrux debe poder mantenerlo **una sola persona** (RNF-70) y crecer de una beta de 30 a 50 testers hasta la meta de 10.000 a 60.000 usuarios activos al mes, **sin que el costo crezca antes que los ingresos** (RNF-61). Este ADR fija las tácticas para ambos atributos, de modo que no se decidan caso a caso durante el desarrollo.

## Opciones consideradas

### Opción A: Diseñar desde ya para la escala máxima (cachés distribuidas, réplicas, colas)

- **Ventajas:** no habría que rediseñar más adelante.
- **Desventajas:** cuesta dinero y tiempo hoy por una carga que quizá nunca llegue; contradice RES-02 (primero validar).

### Opción B: Escalar por etapas, con los cuellos de botella identificados de antemano

Diseñar para la carga actual sin cerrar el camino: componentes sin estado, límites conocidos y un disparador explícito para cada mejora.

- **Ventajas:** costo cero hoy; cada inversión responde a una medición (ADR-0030).
- **Desventajas:** exige medir y revisar los disparadores.

## Decisión

**Opción B.**

### Mantenibilidad

| Táctica | Detalle |
|---|---|
| Módulos con límites verificados | Reglas de ADR-0019, comprobadas en CI con `dependency-cruiser`. |
| Dominio puro | Las reglas de franquicia, contador y plan viven en `packages/domain`, sin I/O, con la mayor cobertura de pruebas (ADR-0029). |
| Contratos tipados | Esquemas Zod en `packages/shared`; contrato OpenAPI generado y verificado en CI (ADR-0018, ADR-0023). |
| Un lenguaje y una herramienta de calidad | TypeScript estricto en todo el monorepo; Biome para lint y formato (ADR-0003). |
| Textos fuera del código | i18n en archivos por idioma (ADR-0010): agregar un idioma no cambia la lógica (RNF-71). |
| Historial legible | Conventional Commits, PRs pequeños y release-please (ADR-0027). |
| Decisiones registradas | Toda decisión estructural pasa por un ADR. |
| Dependencias al día | Dependabot semanal, con actualizaciones agrupadas para reducir el ruido (ADR-0027). |
| Cambios graduales | Banderas de funcionalidad de PostHog (gratis) para activar funciones por porcentaje o por usuario (ADR-0030). |

### Escalabilidad

| Componente | Cómo escala | Primer límite esperado | Disparador y respuesta |
|---|---|---|---|
| SPA | Archivos estáticos en el CDN de Vercel | Ancho de banda de Hobby | Vercel Pro |
| API | Funciones **sin estado**: no hay sesión en memoria ni archivos locales; todo estado vive en Postgres | Conexiones a Postgres | Usar siempre el pooler de Supabase en modo transacción |
| Catálogo (AniList) | Consultas desde el navegador de cada usuario (ADR-0024): el límite de peticiones se reparte entre usuarios | Límite por usuario | Caché en memoria del cliente y espera con reintento ante `429` |
| Postgres | Solo se guardan identificadores y marcas, no el catálogo (ADR-0022) | Unos 500 MB de la capa gratuita | Supabase Pro (8 GB) |
| Perfil público | Lectura pública con cabeceras de caché del CDN | Lecturas repetidas de perfiles virales | `Cache-Control` con `s-maxage` corto en la API pública |

**Estimación de almacenamiento (orden de magnitud, a validar):** una marca ocupa unos 200 bytes, índices incluidos. Con 300 marcas por usuario, la capa gratuita de 500 MB alcanza para unos 8.000 usuarios con datos. Es el primer límite de costo y aparece mucho después de la beta.

## Consecuencias

- **Positivas:** costo cero hasta tener tracción; cada mejora de capacidad tiene un disparador medible.
- **Negativas / riesgos:** si no se miden los indicadores técnicos (ADR-0030), un límite puede llegar sin aviso.
- **Acciones derivadas:**
  - Alerta en Supabase al 80 % del almacenamiento.
  - Revisión mensual de los indicadores técnicos de ADR-0030 frente a esta tabla.

