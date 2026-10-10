# ADR-0005: Plataforma prioritaria: mobile primero, sin modo offline

- **Estado:** Aceptado
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 001 (D1, D2), Reunión 003 (D14)

## Contexto

Acrux es una microapp de portafolio cuyo diferenciador es la **simplicidad: solo marcar y ver** (D1). Está pensada para fans casuales, otakus que quieren compartir su lista y usuarios de MyAnimeList o AniList que encuentran esas plataformas pesadas. El caso de uso (marcar animes vistos y compartir el total) ocurre sobre todo en el teléfono.

Con un plazo de 18 días y un solo programador, no es viable construir mobile y web a la vez.

## Opciones consideradas

### Opción A: Mobile primero (Android e iOS), web después

- **Ventajas:** se enfoca donde está el usuario; publicar en las tiendas es una pieza fuerte de portafolio.
- **Desventajas:** depende de los tiempos de revisión de las tiendas (ADR-0011).

### Opción B: Web primero

- **Ventajas:** despliegue inmediato, sin revisión de tiendas.
- **Desventajas:** no es la plataforma prioritaria del stakeholder.

### Sobre el modo offline

- **Con offline:** requiere base local, sincronización y resolución de conflictos.
- **Solo con conexión:** la app consulta Supabase directamente.

## Decisión

- **Mobile primero, Android e iOS** (D2). La web queda para después del MVP (épica E6).
- **Solo con conexión a internet** en el MVP (D14).

## Consecuencias

- **Positivas:** alcance acotado; sin lógica de sincronización.
- **Negativas / riesgos:** sin conexión la app no sirve; hay que mostrar estados de error y de carga claros. La publicación depende de las tiendas (R3, R4).
- **Acciones derivadas:** diseñar los estados «sin conexión» y «error al cargar»; la tecnología de la app debe cubrir Android e iOS con un solo código (ADR-0003).
