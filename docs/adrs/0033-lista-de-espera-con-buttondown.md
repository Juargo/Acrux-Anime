# ADR-0033: Lista de espera con Buttondown

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27. Resuelve el pendiente P-12 de [`docs/requisitos`](../requisitos/README.md) para la lista de espera de la landing de validación (H1, ADR-0031).

**Complementa:** ADR-0028, lista de encargados del tratamiento: se agrega Buttondown.

## Contexto

- La landing de validación (`acruxanime.com`, H1) registra el correo de quien quiere entrar a la beta (RF-80, RDI-19) y mide el registro con el evento `waitlist_joined` (umbral ≥15 %, ADR-0030).
- Más adelante hay que enviar la invitación a la beta, y la página de soporte (D43 en Figma) promete un enlace para salir de la lista en cada correo.
- En H1 todavía no existe la API (ADR-0018). ADR-0022 desactiva la Data API de Supabase y activa RLS sin políticas, así que la landing no puede escribir directamente en Postgres.
- La capa gratuita de Supabase permite dos proyectos activos, y los dos cupos de la cuenta del stakeholder están ocupados por otros proyectos.

## Opciones consideradas

| Opción | Resultado | Motivo |
|---|---|---|
| Tabla en el Postgres de Supabase | Descartada | Exige liberar un cupo de Supabase y crear un endpoint antes de tener API; además hace falta un servicio de correo para invitar y gestionar bajas. |
| PostHog | Descartada | ADR-0030 prohíbe enviar el correo como propiedad; depende del consentimiento de analítica, así que quien la rechace no quedaría registrado; no envía correos. |
| Resend | Descartada para H1 | Sirve también para los correos de la app, pero el formulario, la doble confirmación y las bajas hay que construirlos. |
| **Buttondown** | **Elegida** | Guarda la lista, envía la confirmación y la invitación, e incluye el enlace de baja; no requiere Supabase ni API en H1. |

## Decisión

**Buttondown** guarda la lista de espera y envía los correos de la lista.

1. **Doble confirmación** (activada por defecto en Buttondown): el correo queda pendiente hasta que la persona confirma. Sirve como prueba del consentimiento (Ley 21.719, GDPR). El mensaje de éxito del formulario pide revisar el correo.
2. **Alta desde la landing** con el formulario de la landing (Astro) contra Buttondown. Si se usa la API, la clave vive solo en una función del servidor de Vercel, nunca en el navegador.
3. **Medición sin datos personales:** al confirmar el envío, la landing registra `waitlist_joined` en PostHog solo si hay consentimiento, sin el correo (ADR-0030). La lista de Buttondown no depende del consentimiento de analítica.
4. **Baja:** cada correo lleva el enlace de baja de Buttondown.
5. **Paso a la beta (H2):** se exporta la lista de confirmados para enviar las invitaciones. Al terminar la beta, la lista se borra en Buttondown.
6. **Encargado del tratamiento:** Buttondown se agrega a la política de privacidad junto a los de ADR-0028.

## Consecuencias

- **Positivas:** H1 funciona sin Supabase ni API; doble confirmación y bajas sin código propio.
- **Negativas / riesgos:**
  - **La capa gratuita cubre hasta 100 suscriptores**; el plan Basic cuesta US$9/mes (precios consultados el 2026-10-27, sujetos a cambio). Si la landing supera ese número, H1 deja de costar US$0.
  - Un encargado del tratamiento más, con datos fuera de la base propia.
  - Las personas que no confirman el correo no cuentan como registro real; el umbral de ≥15 % debe medirse sobre envíos y, aparte, revisar la tasa de confirmación.
- **Acciones derivadas:**
  - Crear la cuenta de Buttondown, con textos de confirmación en español y la URL de redirección tras confirmar.
  - Agregar Buttondown a la política de privacidad (D42 y M42 en Figma).
  - Revisar el número de suscriptores antes de llegar a 100.
