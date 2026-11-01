# ADR-0035: Respaldos en Backblaze B2, en lugar de Cloudflare R2

- **Estado:** Aceptado
- **Fecha:** 2026-11-01
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-01, durante el issue #25.

**Reemplaza:**

- ADR-0022, sección «Respaldos»: el bucket privado de Cloudflare R2. Siguen vigentes el `pg_dump` semanal, el cifrado con `age` y la regla de no guardar el respaldo como artefacto de Actions.
- ADR-0028, «Privacidad por defecto», punto 5: Cloudflare como encargado del tratamiento de los respaldos.
- ADR-0034, «Base de datos», punto 5: Cloudflare R2 como destino.

## Contexto

- Activar R2 pide cargar una tarjeta o PayPal en Cloudflare, aunque el uso quede dentro de la capa gratuita. El stakeholder pidió una alternativa completamente gratuita por ahora.
- El respaldo debe seguir en un almacenamiento privado, con expiración automática compatible con los 30 días de ADR-0032.

## Opciones

### Opción A: mantener Cloudflare R2

- **Ventajas:** sin cambios; ADR y política de privacidad ya lo reflejan.
- **Desventajas:** exige cargar un medio de pago.

### Opción B: Backblaze B2

- **Ventajas:** 10 GB gratis y su página de registro indica que no pide tarjeta; compatible con S3, así que el script casi no cambia; tiene reglas de ciclo de vida.
- **Desventajas:** suma otro encargado del tratamiento; sus reglas de ciclo de vida primero ocultan el archivo y luego lo borran, y no corren en tiempo real.

### Opción C: repositorio privado de GitHub

- **Ventajas:** no suma una cuenta nueva.
- **Desventajas:** sin expiración automática, habría que programar el borrado; un repositorio no es almacenamiento de respaldos.

## Decisión

**Opción B.** Los respaldos se guardan en un bucket privado de **Backblaze B2**, por ahora. La regla de ciclo de vida oculta cada archivo a los 28 días y lo borra un día después, para no pasar de los 30 días de ADR-0032 aunque la regla corra con retraso.

## Consecuencias

- **Positivas:** ningún medio de pago cargado; el flujo de respaldo se mantiene con el `aws` CLI.
- **Negativas / riesgos:**
  - Superar los 10 GB gratuitos exigiría pagar o cambiar de proveedor. El respaldo cifrado de la beta queda muy por debajo.
  - La política de privacidad promete acuerdos de tratamiento de datos: hay que aceptar el de Backblaze antes de guardar el primer respaldo.
- **Acciones:**
  - Cambiar Cloudflare por Backblaze en la política de privacidad, en español y en inglés.
  - Configurar el bucket y la regla de ciclo de vida según [`docs/runbooks/respaldos.md`](../runbooks/respaldos.md).
