# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Principal: la otaku que comparte** (segmento B, «Camila»). Usa el celular, quiere mostrar su contador y
  su lista en Stories y TikTok. Es el motor de crecimiento.
- **Fan casual** (segmento A, «Diego»). Quiere saber qué vio y qué le falta de una saga, sin esfuerzo.
- **Usuario de MyAnimeList o AniList cansado** (segmento C, «Javier»). Quiere menos desorden de entradas.
- El completista que sigue episodios y puntuaciones no es el público.

Fuente: `docs/requisitos/01-negocio-y-usuario.md`.

## Product Purpose

Acrux registra el historial de anime de una persona contando **una franquicia como un solo ítem**, con todas
sus temporadas, películas y OVAs adentro, y lo convierte en una **tarjeta vertical** lista para compartir.
La métrica estrella son las tarjetas compartidas por semana; la meta es menos de 3 minutos entre el registro
y la primera tarjeta compartida.

## Positioning

«Tu historial de anime, en una sola tarjeta. Marca la saga, no las temporadas, y compártelo en segundos.»
El diferenciador es la combinación de un ítem por franquicia, tarjeta vertical para compartir, español
nativo con foco en Latinoamérica y Chile, y una web app simple pensada primero para el celular.

## Operating Context

- Se usa sobre todo en el celular, en ratos cortos, y el resultado sale de la app hacia Instagram Stories
  y TikTok.
- El perfil público se abre por enlace, sin crear cuenta.
- Hay dos superficies: la landing (`apps/landing`, Astro) y la web app (`apps/web`, React).

## Capabilities and Constraints

- Entrar con Google, marcar una franquicia como vista o viendo con un toque, contador por franquicias o por
  entradas, progreso de saga («3/5 temporadas»), tarjeta para compartir, perfil público o privado, descarga
  y borrado de datos.
- Idiomas: español e inglés.
- El catálogo y los datos vienen de MyAnimeList, con crédito y enlace (ADR-0043).
- Fuera de alcance: seguimiento por episodio, reseñas, foros, manga, recomendaciones con IA, apps nativas.
- Monetización (anuncios y Plus vitalicio) apagada por ahora (ADR-0044). Nunca hay anuncios en la tarjeta
  compartida, el perfil público, el inicio de sesión ni el borrado de cuenta.

## Brand Commitments

- El nombre **Acrux** y el dominio `acruxanime.com` son fijos.
- Todo lo demás (logo, colores, tipografía, voz) se rediseña de cero (decisión del 2026-11-19). La
  identidad anterior es referencia de lo que se deja atrás, no una autoridad.

## Evidence on Hand

- Requisitos vigentes en `docs/requisitos/` y decisiones en `docs/adrs/`.
- Portadas y títulos reales del catálogo de MyAnimeList.
- No hay testimonios, cifras de uso ni prensa: no se inventan.

## Product Principles

1. Compartir es la función central, no un extra.
2. La saga es la unidad: nunca se cuenta por temporada salvo que la persona lo elija.
3. Un toque para registrar; nada debe pedir más esfuerzo que eso.
4. Primero el celular.
5. Español nativo, no traducido.
