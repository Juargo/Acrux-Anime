# ADR-0036: Monetización con anuncios no intrusivos y Plus vitalicio

- **Estado:** Aceptado. El punto 2 lo modifica ADR-0039: los temas de tarjeta salen de Plus.
- **Fecha:** 2026-11-06
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-06.

**Reemplaza:**

- ADR-0025, «Pagos»: el plan anual de Plus. Sigue vigente Lemon Squeezy como medio de cobro y la regla de que el plan se lee solo en el servidor (`requirePlan('plus')`).
- DD-28: los precios de referencia de Plus pasan a ser solo el pago vitalicio.

## Contexto

- El stakeholder considera que Acrux no ofrece un uso mensual que justifique una suscripción, y prefiere empezar con anuncios.
- El modelo vigente ya no tenía plan mensual: Plus era anual (US$9,99) o vitalicio (~US$19,99), según RN-07.
- La publicidad no evita el requisito de licencia: los términos de MyAnimeList exigen autorización escrita para obtener ingresos o agregar publicidad (ADR-0008), y RN-08 exige licencia comercial de AniList para cualquier ingreso. R-01 sigue abierto (issue #6).
- RN-05 ya permite anuncios no intrusivos, nunca en la tarjeta compartida.
- Las redes de anuncios usan cookies o identificadores de terceros, lo que exige consentimiento (Ley 21.719 y GDPR básico, ADR-0028).

## Opciones

### Opción A: mantener Plus anual y vitalicio, sin anuncios

- **Ventajas:** sin cambios; ningún tercero nuevo que trate datos.
- **Desventajas:** el plan anual es una suscripción, que el stakeholder no cree que la gente quiera pagar; sin ingresos de usuarios que no pagan.

### Opción B: solo anuncios, sin Plus

- **Ventajas:** nadie tiene que pagar; un solo modelo.
- **Desventajas:** en un nicho chico con tráfico mayormente latinoamericano, los ingresos por anuncio suelen ser bajos (estimación no verificada); las redes piden un tráfico mínimo para aprobar el sitio; no hay forma de quitar los anuncios.

### Opción C: anuncios no intrusivos y Plus vitalicio sin anuncios

- **Ventajas:** quien no paga financia con anuncios; quien quiere apoyar paga una sola vez y deja de verlos; no hay suscripción.
- **Desventajas:** suma una red de anuncios como encargado del tratamiento, un aviso de consentimiento para publicidad y más trabajo en la política de privacidad.

## Decisión

**Opción C.**

1. Los usuarios gratuitos ven anuncios no intrusivos. Nunca hay anuncios en la tarjeta compartida, en el perfil público, en el flujo de inicio de sesión ni en el borrado de cuenta.
2. Plus es **solo vitalicio**, de pago único, con precio de referencia de ~US$19,99 y precio regional para Latinoamérica. Se retira el plan anual. Plus quita los anuncios y mantiene sus beneficios: plantillas y temas extra, estadísticas avanzadas, Wrapped, insignias e íconos.
3. Los anuncios personalizados se muestran solo con consentimiento; sin él, la app muestra anuncios no personalizados o ninguno, según lo que permita la red elegida.
4. Ni los anuncios ni Plus se activan sin la autorización y la licencia comercial de AniList (RN-08) y, si se usa MyAnimeList, su autorización escrita (ADR-0008). Ambos llegan en H4.
5. La red de anuncios y los espacios concretos quedan por decidir (P-13).

## Consecuencias

- **Positivas:** desaparecen las renovaciones, los pagos fallidos, los vencimientos y la cancelación de la suscripción al borrar la cuenta (P-05 queda sin objeto).
- **Negativas / riesgos:**
  - Ingresos inciertos: la meta de conversión a Plus (RN-M4) y los ingresos por anuncio deben medirse antes de proyectar.
  - La red de anuncios es un nuevo encargado del tratamiento y debe figurar en la política de privacidad.
  - Los anuncios pueden empeorar la experiencia en el celular; deben respetar RNF de rendimiento y no tapar contenido.
- **Acciones:**
  - Elegir la red de anuncios y los espacios (P-13) antes de H4.
  - Agregar la red de anuncios a la política de privacidad, en español y en inglés, y extender el aviso de consentimiento a la publicidad.
  - Al llegar la respuesta de AniList (#6), confirmar que la licencia cubre ingresos por publicidad.
