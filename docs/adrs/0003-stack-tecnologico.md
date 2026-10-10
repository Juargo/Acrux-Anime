# ADR-0003: Stack tecnológico

- **Estado:** Propuesto (varias capas ya decididas en ADRs propios)
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (supuesto S3), Reunión 002 (D8), Reunión 005 (D18)

## Contexto

Este ADR reúne la visión completa del stack. Las capas que ya se decidieron en las reuniones tienen su propio ADR; aquí se registran las que todavía están abiertas y la coherencia del conjunto.

Criterios:

1. **Plazo de 18 días:** tecnologías que el desarrollador ya conoce y con poca configuración.
2. **Mobile primero** en Android e iOS con un solo código (ADR-0005).
3. **Un solo lenguaje** en todo el monorepo (ADR-0002).
4. **Costo bajo:** capas gratuitas de los servicios gestionados.
5. **Publicación en tiendas** sin pasos manuales complejos (firma, builds, envío).

## Resumen del stack

| Capa | Elección | Estado | Referencia |
|---|---|---|---|
| Lenguaje | TypeScript | Propuesto | Este ADR |
| App móvil | Expo (React Native) | Propuesto (supuesto S3; ya figura en el plan del Sprint 0) | Este ADR |
| Builds y envío a tiendas | EAS Build y EAS Submit | Propuesto | Este ADR |
| Backend (Auth, base de datos, funciones) | Supabase | **Aceptado** (D8) | ADR-0006 |
| Autenticación | Google y Apple vía Supabase Auth | **Aceptado** (D7) | ADR-0007 |
| Fuente del catálogo | anime-offline-database (en revisión frente a Jikan) | Propuesto | ADR-0008 |
| Internacionalización | Español e inglés desde el inicio | **Aceptado** (D13) | ADR-0010 |
| Landing page | Alojada en Vercel | **Aceptado** (D18) | ADR-0012 |
| Gestión del monorepo | pnpm workspaces | Propuesto | ADR-0002 |

## Capas abiertas: opciones consideradas

### App móvil

| Opción | Comentario |
|---|---|
| **Expo (React Native) con TypeScript** (propuesto) | Conocimiento previo del stakeholder (S3); un código para Android e iOS; EAS resuelve builds, firma y envío a las tiendas; SDK de Supabase compatible. |
| React Native sin Expo | Más control nativo, pero firma y builds manuales: costo alto para el plazo. |
| Flutter | Buen rendimiento, pero otro lenguaje (Dart) y sin conocimiento previo. |

### Librerías propuestas para la app (a confirmar en el Sprint 0)

| Necesidad | Propuesta | Motivo |
|---|---|---|
| Navegación | Expo Router | Viene con las plantillas de Expo. |
| Lista grande del catálogo (R6) | FlashList | Lista virtualizada con buen rendimiento en miles de elementos. |
| Datos remotos y paginación | TanStack Query | Caché, paginación infinita y reintentos sobre el cliente de Supabase. |
| i18n | `expo-localization` + i18next | Detecta el idioma del dispositivo; textos en archivos por idioma. |
| Imagen para compartir | `react-native-view-shot` + `expo-sharing` | Se genera en el dispositivo a partir de una vista; sin servidor. |
| Login con Apple | `expo-apple-authentication` | Botón nativo exigido por Apple. |
| Login con Google | Flujo OAuth de Supabase o `@react-native-google-signin/google-signin` | A decidir en el Sprint 0 según la experiencia en cada plataforma. |

### Landing page

| Opción | Comentario |
|---|---|
| **Astro** | Sitio estático, muy liviano, ideal para páginas de texto (privacidad, soporte). |
| Next.js | Más conocido y con más funciones, pero excesivo para unas pocas páginas estáticas. |
| HTML estático | Lo más simple; sin i18n ni componentes. |

### Calidad y CI

| Necesidad | Propuesta |
|---|---|
| Lint y formato | ESLint + Prettier (o Biome) |
| Pruebas unitarias | Jest (estándar en Expo) |
| CI | GitHub Actions: lint y typecheck en cada PR |

## Decisión

**Pendiente** para las capas abiertas. Propuesta: **TypeScript + Expo (Expo Router, FlashList, TanStack Query, i18next) + EAS + Supabase**, con la landing en **Astro** sobre Vercel.

## Consecuencias (si se acepta)

- **Positivas:** un solo lenguaje y un solo código para Android e iOS; EAS reduce el trabajo de firma y envío, que es la parte crítica del hito.
- **Negativas / riesgos:** dependencia de los servicios de Expo (EAS tiene límites de builds en su capa gratuita) y de Supabase.
- **Acciones derivadas:** crear la app con la plantilla de Expo dentro del monorepo y configurar EAS en el Sprint 0.

## Preguntas abiertas

- Confirmar Expo como tecnología de la app (supuesto S3).
- Framework de la landing: Astro, Next.js o HTML estático.
- ¿Alcanzan los builds gratuitos de EAS para el ritmo de publicaciones durante la prueba cerrada?
