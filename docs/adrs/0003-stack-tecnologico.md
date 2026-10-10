# ADR-0003: Stack tecnológico

- **Estado:** Propuesto
- **Fecha:** 2026-10-10
- **Participantes:** Jorge Retamal
- **Origen:** Inicio del proyecto

## Contexto

Hay que elegir las tecnologías base de Acrux-Anime. Los criterios propuestos son:

1. **Un solo lenguaje en todo el monorepo**, para compartir tipos y código entre cliente y servidor (ver ADR-0002).
2. **Productividad** de un equipo pequeño y curva de aprendizaje razonable.
3. **Ecosistema maduro** y comunidad activa.
4. **Costo bajo** de operación en etapa temprana (capas gratuitas, *serverless* o servicios gestionados).
5. Adecuado para un producto con mucho **contenido visual** (catálogo de anime, imágenes, búsquedas) y buena **indexación SEO** si hay páginas públicas.

Este ADR agrupa la discusión; cuando se acepte cada capa, puede separarse en ADRs propios si la decisión lo amerita.

## Opciones consideradas por capa

### Lenguaje

| Opción | Comentario |
|---|---|
| **TypeScript** (propuesto) | Mismo lenguaje en frontend, backend y paquetes compartidos; tipado estático. |
| Python / Go / Java en backend | Buenos ecosistemas, pero rompen el código compartido con el frontend. |

### Gestión del monorepo

| Opción | Comentario |
|---|---|
| **pnpm workspaces + Turborepo** (propuesto) | Simple, rápido, caché local y remota. |
| npm/yarn workspaces + Nx | Más funciones (generadores, grafo de dependencias), más complejidad. |

### Frontend web

| Opción | Comentario |
|---|---|
| **Next.js (React)** (propuesto) | SSR/SSG para SEO, gran ecosistema; puede alojar también rutas de API. |
| React + Vite (SPA) | Más simple, pero sin SSR de serie. |
| Nuxt (Vue) / SvelteKit | Alternativas sólidas con menor ecosistema. |

### Móvil (si aplica)

| Opción | Comentario |
|---|---|
| **React Native + Expo** (propuesto) | Reutiliza React, TypeScript y paquetes del monorepo. |
| Flutter | Excelente rendimiento, pero otro lenguaje (Dart). |
| PWA | Sin tiendas de apps; menor costo; capacidades nativas limitadas. |

### Backend / API

| Opción | Comentario |
|---|---|
| **NestJS** | Estructura modular y opinada; bueno si el dominio crece. |
| **Hono / Fastify** | Livianos y rápidos; menos estructura impuesta. |
| Rutas de API de Next.js | Mínimo esfuerzo al inicio; se acopla al frontend. |
| BaaS (Supabase) | Auth, base de datos, storage y realtime gestionados; menos código propio. |

### Base de datos y persistencia

| Opción | Comentario |
|---|---|
| **PostgreSQL** (propuesto) | Relacional, robusto, búsqueda de texto completo y JSONB. |
| ORM: **Prisma** o **Drizzle** | Tipado de extremo a extremo; Drizzle más liviano, Prisma más maduro. |
| MongoDB | Flexible, pero el dominio (series, temporadas, episodios, usuarios, listas) es marcadamente relacional. |

### Otros componentes a decidir

- **Autenticación:** Auth.js, Clerk, Supabase Auth.
- **Almacenamiento de imágenes:** S3 / Cloudflare R2 / Supabase Storage + CDN.
- **Fuente de datos de anime:** APIs externas (AniList GraphQL, Jikan/MyAnimeList, Kitsu) vs. catálogo propio. Revisar términos de uso y límites de tasa.
- **Pruebas:** Vitest (unitarias), Playwright (E2E).
- **Calidad:** ESLint + Prettier (o Biome), TypeScript estricto.
- **CI/CD:** GitHub Actions.
- **Hosting:** Vercel (frontend), Railway / Fly.io / Render (backend), base de datos gestionada (Neon, Supabase).

## Decisión

**Pendiente.** Propuesta base: **TypeScript + pnpm/Turborepo + Next.js + PostgreSQL**, con las demás capas por definir según los requisitos levantados en las reuniones.

## Consecuencias (si se acepta la propuesta base)

- **Positivas:** un lenguaje en todo el stack; tipos compartidos de extremo a extremo; despliegue gratuito o de bajo costo al inicio.
- **Negativas / riesgos:** dependencia del ecosistema JavaScript y su ritmo de cambio; algunas opciones de hosting atan a proveedores.
- **Acciones derivadas:** fijar versiones (Node LTS, pnpm) en el repositorio; crear el esqueleto del monorepo.

## Preguntas abiertas

- ¿El producto incluye app móvil desde el inicio o solo web?
- ¿Backend propio o BaaS (Supabase) para acelerar el MVP?
- ¿De dónde salen los datos de anime y qué restricciones legales/técnicas tiene la fuente?
- ¿Requisitos de tiempo real (chat, notificaciones, visualización conjunta)?
- ¿Presupuesto mensual objetivo para infraestructura?
