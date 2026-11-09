# ADR-0039: Temas de tarjeta fuera de Plus, como compras sueltas a futuro

- **Estado:** Aceptado
- **Fecha:** 2026-11-09
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-09.

**Modifica:** ADR-0036, punto 2: Plus deja de incluir plantillas y temas extra de tarjeta.

## Contexto

- ADR-0036 definió Plus vitalicio con plantillas y temas extra de tarjeta, estadísticas avanzadas, Wrapped, insignias e íconos, y sin anuncios.
- RF-52 (temas con Plus y vista previa con marca de agua) se construyó en el PR #103, con un solo tema extra: Neón.
- Al probarlo, el stakeholder decidió que los temas se venderán más adelante como compras sueltas (microtransacciones) y no dentro del pago vitalicio.

## Opciones

### Opción A: mantener los temas en Plus

- **Ventajas:** el PR #103 ya está listo; Plus ofrece algo visible desde el primer día.
- **Desventajas:** un tema incluido en el pago vitalicio no se puede vender después por separado a quien ya pagó.

### Opción B: sacar los temas de Plus y venderlos sueltos más adelante

- **Ventajas:** cada tema nuevo puede generar ingresos propios; Plus no promete algo que después cambie.
- **Desventajas:** Plus pierde su beneficio más visible hasta que lleguen estadísticas, Wrapped o insignias; las compras sueltas exigen un modelo de producto y de cobro que todavía no existe.

## Decisión

**Opción B.**

1. Plus vitalicio quita los anuncios y agrega estadísticas avanzadas, Wrapped, insignias e íconos. No incluye temas ni plantillas de tarjeta.
2. Los temas y plantillas extra se venderán como compras sueltas. El modelo (precio, paquetes, medio de cobro y si Plus da algún descuento) queda por decidir (P-14).
3. El PR #103 se cierra sin mergear. La rama `feat/temas-tarjeta` se conserva como base: ya tiene el tema guardado en la cuenta, la vista previa con marca de agua y la regla de que el permiso se comprueba en el servidor.
4. Mientras tanto, todas las tarjetas usan el tema Clásica.

## Consecuencias

- **Positivas:** la pantalla de Plus promete solo lo que Plus incluirá.
- **Negativas / riesgos:**
  - Plus solo quita anuncios hasta que se construyan RF-53 a RF-55.
  - Retomar la rama `feat/temas-tarjeta` exigirá adaptarla al modelo de compras sueltas: hoy la comprobación usa el plan Plus (`plan.plus_required`).
- **Acciones:**
  - Quitar «Todos los temas para tu tarjeta» de la pantalla de Plus.
  - Reescribir RN-06, RU-10 y RF-52, la tabla de permisos y el flujo de compra de Plus.
  - Decidir el modelo de compras sueltas (P-14) antes de retomar los temas.
