# ADR-0032: Retención de los respaldos: 30 días

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Resuelve el pendiente P-04 de [`docs/requisitos`](../requisitos/README.md): Figma fijaba 30 días (DD-32) y los ADRs, 4 semanas.

**Reemplaza:**

- ADR-0022, sección «Respaldos»: la retención de 4 semanas. El resto del respaldo (`pg_dump` semanal cifrado con `age` en un bucket privado de Cloudflare R2) sigue vigente.
- ADR-0028, «Privacidad por defecto», puntos 4 (plazo de supresión en los respaldos) y 7 (retención de 4 semanas).

## Contexto

- La política de privacidad de la landing de validación (H1, ADR-0031) debe informar en cuánto tiempo desaparecen de los respaldos los datos de quien borra su cuenta o sale de la lista de espera (RNF-33, Ley 21.719, GDPR).
- ADR-0022 y ADR-0028 fijaban 4 semanas. El flujo 6 de Figma (DD-32) fijaba 30 días. Las dos cifras no pueden convivir en la política de privacidad.

## Opciones consideradas

### Opción A: 4 semanas (28 días)

- **Ventajas:** coincide con el ritmo semanal del respaldo: se conservan exactamente 4 copias.
- **Desventajas:** un plazo en semanas es menos claro para el usuario que uno en días.

### Opción B: 30 días

- **Ventajas:** plazo fácil de entender y habitual en políticas de privacidad; coincide con el diseño de Figma.
- **Desventajas:** dos días más de conservación de datos borrados.

## Decisión

**Opción B, por ahora.** Los respaldos se conservan **30 días** y la regla de expiración del bucket se configura en 30 días. Un dato borrado desaparece de todos los respaldos a más tardar 30 días después del borrado. La política de privacidad lo informa con esa cifra.

## Consecuencias

- **Positivas:** una sola cifra en los ADRs, los requisitos, Figma y la política de privacidad.
- **Negativas / riesgos:** con respaldos semanales se conservan 4 o 5 copias a la vez; el costo de almacenamiento sigue dentro de la capa gratuita de R2.
- **Acciones derivadas:**
  - Configurar la regla de expiración del bucket de R2 en 30 días.
  - Usar «30 días» en la política de privacidad (D42 y M42 en Figma).
