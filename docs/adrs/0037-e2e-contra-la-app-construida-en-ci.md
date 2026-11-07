# ADR-0037: Pruebas E2E contra la app construida en CI, con Neon Auth simulado

- **Estado:** Aceptado
- **Fecha:** 2026-11-07
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-07, durante el issue #47.

**Reemplaza:**

- ADR-0027, «E2E»: Playwright contra la vista previa de Vercel del PR. Siguen vigentes las vistas previas por PR y el despliegue a producción con su prueba de humo.
- ADR-0029, pirámide de pruebas, fila E2E: «Cada PR, contra la vista previa». Siguen vigentes Playwright, el viewport de teléfono, Chromium y WebKit, AniList interceptado con `page.route()` y los criterios en Gherkin.
- ADR-0029, servicios externos: «JWT firmados con una clave de prueba» deja de referirse a Supabase Auth y pasa a Neon Auth (ADR-0034).

## Contexto

- El issue #47 pedía correr Playwright contra la vista previa del PR, con una sesión creada directo contra Neon Auth.
- Las vistas previas usan la misma instancia de Neon Auth que producción ([`docs/runbooks/inicio-de-sesion.md`](../runbooks/inicio-de-sesion.md)). El único inicio de sesión es con Google, que bloquea los inicios automatizados.
- Los dominios dinámicos de cada vista previa no están entre los dominios de confianza de Neon Auth, y la CSP solo permite el host de Neon Auth de producción.
- El recorrido de borrado de cuenta borraría usuarios reales del Neon Auth de producción ([`docs/runbooks/borrado-de-cuenta.md`](../runbooks/borrado-de-cuenta.md)).
- La API verifica cada JWT contra `<NEON_AUTH_BASE_URL>/.well-known/jwks.json` (`apps/api/src/http/session.ts`). Un servidor JWKS local sirve sin cambiar el código.

## Opciones

### Opción A: la vista previa real

- **Ventajas:** prueba exactamente lo que se despliega en Vercel.
- **Desventajas:** exige habilitar email y contraseña en el Neon Auth de producción, un dominio de vista previa fijo entre los de confianza y un secreto para saltear la protección de Vercel. El borrado corre contra usuarios reales. No funciona en PRs de forks.

### Opción B: la app construida en CI

- **Ventajas:** sin secretos ni acceso a producción; funciona en PRs de forks; datos aislados en un Postgres desechable; resultados repetibles.
- **Desventajas:** no prueba la configuración de Vercel (rewrites, cabeceras, CSP) ni el Neon Auth real.

### Opción C: mixta

- **Ventajas:** los recorridos completos corren en CI y una prueba de humo sin sesión toca la vista previa.
- **Desventajas:** dos suites, y la de la vista previa sigue necesitando el secreto de bypass.

## Decisión

**Opción B.**

1. En cada PR, CI construye la web y la API, y las levanta con Postgres en un contenedor de servicio de GitHub Actions, con las migraciones aplicadas.
2. Neon Auth se simula. Un servidor local publica un JWKS con una clave de prueba y emite los JWT de la sesión; `NEON_AUTH_BASE_URL` apunta a él. En el navegador, Playwright intercepta las llamadas del cliente de Neon Auth y devuelve esa sesión.
3. AniList se intercepta con `page.route()` y devuelve datos fijos.
4. Playwright corre en viewport de teléfono, con Chromium y WebKit.
5. El job se llama **E2E**. Para que bloquee la fusión, el stakeholder lo agrega a los checks requeridos de `main`.

## Consecuencias

- **Positivas:** los recorridos con sesión, incluido el borrado de cuenta, se prueban sin tocar usuarios reales.
- **Negativas / riesgos:**
  - Un error de configuración de Vercel o de Neon Auth no lo detectan los E2E; lo cubren la prueba de humo del despliegue (ADR-0027) y la revisión manual de la vista previa.
  - La simulación de Neon Auth puede quedar desfasada si cambia el cliente `@neon/auth`; las rutas interceptadas viven en un solo archivo.
- **Acciones:**
  - Agregar el check **E2E** a la protección de `main`.
