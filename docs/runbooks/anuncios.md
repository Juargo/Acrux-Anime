# Anuncios (AdSense)

Anuncios para usuarios gratuitos (RF-58), que Plus quita (RF-59). La decisión está en ADR-0038 y el consentimiento en `odd/tasks/anuncios.md` (S3).

## Estado

**Apagados.** En la web no hay `VITE_ADSENSE_CLIENT` ni `VITE_ADSENSE_SLOT`. Mientras falte cualquiera de los dos:

- no se carga el script de AdSense y no aparece ningún espacio;
- el aviso de consentimiento pregunta solo por la analítica, como antes.

## Cómo funciona

- **Espacios:**
  - Hay uno en cada pantalla de esta lista:
    - Inicio, después de los filtros;
    - Mi lista, entre los números y las pestañas;
    - la ficha de franquicia, debajo del detalle;
    - la tarjeta, después de los botones y fuera de la `<figure>`.
  - Cada espacio es un `aside` rotulado «Publicidad» con alto reservado (`apps/web/src/ads/AdSlot.tsx`).
  - No aparece mientras la pantalla carga ni cuando falla.
- **Plan:**
  - El espacio se muestra solo si `/me` dice `plan: 'free'`. Con Plus, o mientras el plan no se conoce, no se monta y el script no se carga.
  - Después de una compra el espacio desaparece, porque lee el perfil compartido en caché.
- **Consentimiento:**
  - Hay dos elecciones separadas, «Analítica» y «Anuncios personalizados».
  - La de anuncios se guarda en `localStorage` como `acrux:ads-consent`, en cada dispositivo. Se cambia desde Perfil → Anuncios personalizados.
  - Sin «Aceptado», cada pedido sale con `requestNonPersonalizedAds = 1`.
- **UE, Reino Unido y Suiza:** decide el CMP de Google con TCF. Se configura en la consola de AdSense (Privacidad y mensajes); no es código.

## Antes de activar

1. Recibir la autorización de AniList (#6), como exige ADR-0036, punto 4.
2. Confirmar si con la Ley 21.719 (Chile) las cookies de frecuencia y fraude de AdSense necesitan consentimiento (ADR-0038). Si lo necesitan, sin consentimiento hay que pasar a anuncios limitados o a ninguno.
3. Publicar contenido en `acruxanime.com` y pedir la cuenta de AdSense con ese sitio.
4. **Decidir la CSP.** Google solo soporta una política estricta basada en nonce (`'strict-dynamic'`) y no una lista de dominios permitidos ([AdSense Help](https://support.google.com/adsense/answer/16283098)). Hoy la web es una SPA estática con `script-src 'self'` (`apps/web/vercel.json`). Hay tres opciones:
   - **A. Nonce por petición:** un middleware de Vercel genera un nonce, lo agrega al HTML y la CSP usa `'strict-dynamic'`. Es lo que soporta Google, pero el `index.html` deja de ser estático.
   - **B. Lista de dominios:** agregar `pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`, `tpc.googlesyndication.com` y otros a `script-src`, `frame-src`, `img-src` y `connect-src`. Google no la soporta y puede bloquear anuncios sin avisar cuando cambie sus dominios.
   - **C. Abrir `script-src`** a `https:`. Es simple, pero debilita mucho la protección contra XSS.
   
   Cualquier cambio en la CSP es de seguridad y necesita su propia revisión y un test en `apps/web/src/vercel-config.test.ts`.
5. Publicar `ads.txt` en `acruxanime.com` y `app.acruxanime.com` con la línea que da AdSense: `google.com, pub-XXXXXXXX, DIRECT, f08c47fec0942fa0`.
6. Configurar el mensaje de privacidad (TCF) en la consola de AdSense para la UE, el Reino Unido y Suiza.

## Activar

1. En Vercel, proyecto `app`, entorno Production, agregar:
   - `VITE_ADSENSE_CLIENT=ca-pub-…`
   - `VITE_ADSENSE_SLOT=<id de la unidad display adaptable>`
2. Volver a desplegar la web. Son variables de compilación, así que exigen un build nuevo.
3. Comprobar con una cuenta gratuita:
   - aparece «Publicidad» en las cuatro pantallas;
   - el aviso pide las dos elecciones;
   - con Plus no hay anuncios, y en la pestaña Red no hay pedidos a `googlesyndication`.

## Apagar

Quitar `VITE_ADSENSE_CLIENT` o `VITE_ADSENSE_SLOT` y volver a desplegar. La elección guardada de cada usuario queda en su dispositivo, pero ya no se usa.
