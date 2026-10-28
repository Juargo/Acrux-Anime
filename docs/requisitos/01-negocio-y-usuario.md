# Requisitos de negocio y de usuario

## Problema y propuesta de valor

**Problema:** en los trackers actuales (MyAnimeList, AniList) cada temporada, cour, OVA y película es una entrada aparte. Las listas quedan desordenadas, el conteo se infla y cuesta saber qué falta de una saga.

**Propuesta de valor:** *"Tu historial de anime, en una sola tarjeta. Marca la saga, no las temporadas, y compártelo en segundos."*

## Requisitos de negocio

| ID | Requisito | Prioridad | Origen |
|---|---|---|---|
| RN-01 | Acrux sirve como proyecto de portafolio que demuestra un producto completo **en producción en la web**. | Must | Reunión 001; modificado por ADR-0031 (sin tiendas) |
| RN-02 | El diferenciador es la combinación de: un ítem por franquicia, tarjeta vertical para compartir, español nativo con foco en Latinoamérica y Chile, y una web app simple pensada primero para el celular. | Must | Estudio de mercado; ADR-0013 |
| RN-03 | Compartir es la función central y el motor de crecimiento orgánico, no un extra. | Must | Estudio de mercado |
| RN-04 | Antes de construir en serio se valida la demanda. No hay fecha fija de lanzamiento; se avanza por hitos con umbral. | Must | Decisión 26-oct; ADR-0031 |
| RN-05 | Freemium sin anuncios intrusivos. Marcar, el contador y la tarjeta básica son gratis para siempre. Nunca hay anuncios en la tarjeta compartida. | Must | Estudio de mercado |
| RN-06 | Plan **Plus** de pago con plantillas y temas extra de tarjeta, estadísticas avanzadas, Wrapped completo, insignias e íconos. | Must | Estudio de mercado |
| RN-07 | Precios de referencia de Plus: US$9,99/año y pago vitalicio de ~US$19,99, con precio regional para Latinoamérica. El plan mensual queda para el futuro. | Should | Estudio de mercado; DD-28 |
| RN-08 | El producto opera legalmente con el catálogo y los datos de AniList, incluido el escenario de ingresos sobre el umbral de uso comercial gratuito. Plus no se cobra sin autorización y licencia de AniList. | Must | Estudio §5.2; ADR-0024 |

## Hitos

| Hito | Entrega | Condición para avanzar |
|---|---|---|
| **H1. Validación** | Entrevistas, encuesta y landing de prueba en `acruxanime.com` con lista de espera y medición en PostHog. Correos de autorización a AniList y MyAnimeList. | Se cumplen los umbrales de validación |
| **H2. Beta cerrada** | Web app en `app.acruxanime.com` para 30 a 50 testers: login con Google, marcar franquicias, contador, tarjeta, perfil público y borrado de cuenta. Sin cobro. | RN-M1 a RN-M3 medidas y autorización escrita de AniList |
| **H3. Lanzamiento público** | Apertura a todos, en español e inglés. | Licencia comercial de AniList, Vercel Pro y Lemon Squeezy configurado |
| **H4. Cobro de Plus** | Plan anual y vitalicio. | — |

Si AniList y MyAnimeList responden que no, se detiene el avance después de H1 y se reconsidera el modelo (ADR-0031).

## Plan de validación (H1)

| Paso | Detalle | Umbral para seguir |
|---|---|---|
| Entrevistas | 15–20 personas (≈8 en Chile; el resto en México y Argentina), segmentos A, B y C | ≥40 % compartiría la tarjeta |
| Encuesta | 300+ respuestas: dispositivo, tracker actual, preferencia de conteo, disposición a pagar | ≥25 % prefiere conteo por franquicia; ≥5 % elige una opción de pago |
| Landing de prueba | Propuesta de valor, mockups de la tarjeta, botón "Únete a la beta" | ≥15 % de registro en la lista de espera |
| Beta (H2) | 30–50 testers | RN-M1 a RN-M3 |

## Métricas de éxito

| ID | Métrica | Meta | Medición (ADR-0030) |
|---|---|---|---|
| RN-M0 | Estrella polar: tarjetas compartidas por semana | En aumento | `card_shared` |
| RN-M1 | Tiempo hasta la primera tarjeta compartida | < 3 minutos (mediana) | `signup_completed` → `card_shared` |
| RN-M2 | Tasa de compartir por usuario activo | Por definir tras la beta | `card_shared` / activos |
| RN-M3 | Retención D7 y D30 | Por definir tras la beta | Retención en PostHog |
| RN-M4 | Conversión a Plus | 2–5 % | `plus_purchased` / activos |

Estimaciones del estudio (no verificadas): SAM de 1,6–6 M de hispanohablantes con smartphone; meta a 3 años de 10.000–60.000 usuarios activos al mes; ingresos de US$2.000–45.000 al año.

## Segmentos

| Segmento | Persona | Prioridad | Qué necesita |
|---|---|---|---|
| B. Otaku que comparte | Camila | Muy alta (motor viral) | Mostrar su contador y su lista en Stories y TikTok |
| A. Fan casual | Diego | Alta (volumen) | Saber qué vio y qué le falta de una saga, sin esfuerzo |
| C. Usuario de MAL o AniList cansado | Javier | Alta (adopción temprana) | Menos desorden de entradas, sin perder su AniList |
| D. Completista | Marcela | Baja (no es el público) | Episodios, puntuaciones y estadísticas finas |

## Necesidades del usuario

| ID | Como… | Quiero… | Para… | Prioridad |
|---|---|---|---|---|
| RU-01 | Fan casual | entrar con mi cuenta de Google sin crear otra cuenta | empezar en segundos | Must |
| RU-02 | Usuario de AniList | vincular mi cuenta de AniList | no llevar dos listas | Should |
| RU-03 | Cualquier usuario | ver cada anime como un solo ítem con todas sus temporadas, películas y OVAs | entender qué he visto de una saga | Must |
| RU-04 | Cualquier usuario | marcar una franquicia como vista o viendo con un toque | registrar sin fricción | Must |
| RU-05 | Cualquier usuario | ver cuántos animes he visto de verdad, y poder contar por entradas | elegir el conteo que prefiero | Must |
| RU-06 | Otaku que comparte | generar una tarjeta vertical con mi total, mi nombre, mi avatar y lo que estoy viendo | subirla a Stories y TikTok | Must |
| RU-07 | Cualquier usuario | ver qué me falta de una saga ("3/5 temporadas") | saber qué ver después | Should |
| RU-08 | Otaku que comparte | tener un enlace público a mi perfil | que otros vean mi lista sin crear una cuenta | Must |
| RU-09 | Cualquier usuario | decidir si mi lista es pública o privada | controlar qué muestro | Must |
| RU-10 | Usuario Plus | usar temas y plantillas extra, estadísticas y un Wrapped | personalizar y presumir mi historial | Should |
| RU-11 | Hispanohablante | usar la app en español (o inglés) | entenderla sin esfuerzo | Must |
| RU-12 | Cualquier usuario | descargar mis datos y borrar mi cuenta | tener control sobre mi información | Must |

RU-02 pasa a Should porque el vínculo con AniList no entra en H2 (ADR-0031). RU-10 pasa a Should porque Plus llega en H4.

## Fuera de alcance

Seguimiento por episodio, reseñas y foros, manga, recomendaciones con IA, apps nativas, separar o unir franquicias por usuario (lo reemplaza el reporte al curador, RF-62), historial de "Actividad reciente" (DD-36), importación desde MAL, comparación con amigos, widget, aviso de nueva temporada y modo sin conexión.
