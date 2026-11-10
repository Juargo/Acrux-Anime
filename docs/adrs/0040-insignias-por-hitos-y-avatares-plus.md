# ADR-0040: Insignias por hitos y avatares exclusivos como «insignias e íconos» de Plus

- **Estado:** Aceptado
- **Fecha:** 2026-11-09
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-09 (RF-55).

**Complementa:** ADR-0036, punto 2. Precisa qué son las «insignias e íconos» de Plus.

## Contexto

- RF-55 dice solo «Plus desbloquea insignias e íconos.». No hay diseño en Figma.
- Una PWA no puede cambiar su ícono instalado para un usuario. El manifiesto es uno solo para todo el sitio. Chrome aplica un cambio de ícono cuando quiere, e iOS exige reinstalar ([web.dev, «How Chrome handles updates to the web app manifest»](https://web.dev/articles/manifest-updates)).
- La API guarda solo los ids de AniList de cada marca. Las horas y los géneros se calculan en el navegador (RF-53, ADR-0024).

## Opciones

### Insignias

- **A. Logros por hitos (elegida):** se ganan por títulos vistos, horas vistas y géneros distintos. Todos ven su progreso; con Plus se muestran a otros.
- **B. Un sello «Plus»:** es simple, pero solo reconoce la compra.
- **C. Insignias decorativas para elegir:** no tienen condiciones y no premian el uso.

### Íconos

- **A. Avatares exclusivos de Plus (elegida):** son tres avatares predefinidos más, sobre el `avatarPreset` que ya existe. Se pueden hacer hoy.
- **B. Postergar los íconos** hasta tener una app nativa.
- **C. Sacarlos de Plus.**

## Decisión

1. **Insignias por hitos:**
   - Títulos vistos: 10, 50, 100 y 250.
   - Horas vistas: 50, 200 y 500.
   - Géneros distintos: 5 y 10.
   - Cuentan solo las marcas «vistas».
2. **Cálculo y guardado:**
   - El navegador calcula las insignias con las mismas estadísticas de RF-53.
   - Las guarda con `PATCH /me {badges}`, igual que el contador (ADR-0024). La API acepta solo ids del catálogo, cada uno una vez.
   - Se guardan también para usuarios gratuitos, así aparecen apenas compran Plus.
3. **Quién las ve:**
   - Todos ven sus propias insignias y su progreso en Perfil → Insignias.
   - El perfil público (`GET /profiles/:handle`) y la tarjeta las muestran solo mientras el dueño tiene Plus.
4. **Avatares exclusivos:**
   - Son tres: `sakura`, `aurora` y `eclipse`.
   - `PATCH /me` responde 403 `plan.plus_required` si los pide alguien sin Plus.
   - Al leerlos sin Plus (en `/me`, el perfil público y la imagen OG) se ven como nulos. El valor guardado se conserva: un reembolso los oculta y una compra nueva los devuelve (RF-56).

## Consecuencias

- **Positivas:**
  - Plus suma algo visible para otros sin depender de una app nativa.
  - Las insignias premian el uso, y el usuario gratuito ve qué ganaría.
- **Negativas / riesgos:**
  - Como el contador, las insignias las calcula el cliente y el servidor confía en ellas. Alguien podría guardar insignias que no ganó. Son cosméticas y no dan ningún permiso.
  - Las insignias se actualizan cuando el usuario abre Insignias; la tarjeta y el perfil público muestran las últimas guardadas.
- **Acciones:**
  - En la pantalla de Plus, «Insignias e íconos de la app» pasa a ser «Insignias y avatares exclusivos».
  - Reescribir RF-55, RN-06 y la tabla de permisos.
