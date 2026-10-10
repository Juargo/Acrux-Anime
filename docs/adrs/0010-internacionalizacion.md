# ADR-0010: Internacionalización en español e inglés desde el inicio

- **Estado:** Aceptado
- **Fecha:** 2026-10-10
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Reunión 003 (D13)

## Contexto

El nombre de trabajo es **Acrux** y la app debe estar en **español e inglés** (D13). Añadir i18n después obliga a revisar cada texto de la interfaz; hacerlo desde el inicio cuesta poco.

## Opciones consideradas

- **i18n desde el inicio:** todos los textos en archivos de traducción desde la primera pantalla.
- **Solo español y traducir después:** más rápido al principio, pero retrabajo seguro.

## Decisión

**i18n desde el inicio**, con español e inglés. El idioma se toma del dispositivo y se usa inglés por defecto si el idioma no es ninguno de los dos.

## Consecuencias

- **Positivas:** sin retrabajo; las fichas de las tiendas también salen en ambos idiomas.
- **Negativas / riesgos:**
  - Doble trabajo de textos: app, fichas de las tiendas, capturas, landing y política de privacidad.
  - Los títulos de anime del dataset no se traducen; se muestran como vienen (título principal y, si hay, sinónimos).
  - Los nombres de los géneros curados (ADR-0008) sí deben traducirse.
- **Acciones derivadas:**
  - Paquete `packages/i18n` compartido entre la app y la landing (ADR-0004).
  - Librerías propuestas: ver ADR-0003.

## Preguntas abiertas

- Idioma por defecto si el dispositivo no está en español ni en inglés (propuesta: inglés).
- Nombre definitivo en las tiendas: ¿«Acrux» está disponible en App Store y Google Play?
