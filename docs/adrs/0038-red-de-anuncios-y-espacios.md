# ADR-0038: Red de anuncios y espacios

- **Estado:** Aceptado
- **Fecha:** 2026-11-08
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-11-08. Resuelve P-13.

**Complementa:** ADR-0036, «Monetización con anuncios no intrusivos y Plus vitalicio», punto 5.

## Contexto

- ADR-0036 decidió mostrar anuncios no intrusivos a los usuarios gratuitos, pero dejó sin decidir la red, las pantallas y qué ve quien no da consentimiento (P-13).
- RN-05 y RF-58 prohíben anuncios en la tarjeta compartida, el perfil público, el inicio de sesión y el borrado de cuenta.
- El tráfico esperado es chico y mayormente latinoamericano.
- Datos revisados el 2026-11-08 en fuentes primarias:
  - AdSense no pide tráfico mínimo. La revisión inicial necesita que el rastreador pueda entrar al sitio sin restricciones. Después de activar la cuenta, se le puede dar un usuario de rastreador para las páginas con login ([AdSense 161351](https://support.google.com/adsense/answer/161351)).
  - Las políticas de Google prohíben anuncios en pantallas sin contenido del editor o con contenido de poco valor, como pantallas de error, de agradecimiento o de navegación ([política](https://support.google.com/publisherpolicies/answer/11112688)).
  - En la UE, el Reino Unido y Suiza, AdSense exige un CMP certificado por Google e integrado con IAB TCF para mostrar anuncios personalizados ([AdSense 13554116](https://support.google.com/adsense/answer/13554116)). AdSense ofrece un CMP propio.
  - Los anuncios no personalizados de AdSense igual usan cookies, para limitar la frecuencia y detectar tráfico inválido. Donde rige la directiva ePrivacy de la UE, esas cookies necesitan consentimiento ([AdSense 9042142](https://support.google.com/adsense/answer/9042142)). Si el usuario no permite ni anuncios personalizados ni no personalizados, AdSense puede mostrar anuncios limitados ([AdSense 14210870](https://support.google.com/adsense/answer/14210870)).
  - Desde el 19 de febrero de 2026, Ezoic exige a los editores nuevos un tráfico alto. Las guías de terceros hablan de unas 250.000 visitas o usuarios al mes; la cifra no está verificada en una fuente oficial ([Ezoic](https://support.ezoic.com/kb/article/getting-started-ezoics-requirements)).
  - Media.net no publica sus requisitos y le va mejor con tráfico de EE. UU. y del Reino Unido.

## Opciones

### Red

- **A. Google AdSense.**
  - **Ventajas:** no pide tráfico mínimo, trae un CMP certificado y permite anuncios en páginas con login.
  - **Desventajas:** la aprobación depende de que haya contenido público y la app está casi toda detrás del login. Google pasa a ser un nuevo encargado del tratamiento.
- **B. Patrocinio directo.**
  - **Ventajas:** no hay terceros, cookies ni consentimiento.
  - **Desventajas:** hay que vender los espacios a mano y los ingresos son inciertos.
- **C. AdSense y patrocinio.**
  - **Ventajas:** son dos fuentes de ingresos.
  - **Desventajas:** hay que mantener dos sistemas.
- Ezoic y Media.net se descartan por sus requisitos de tráfico y por la geografía del público.

### Sin consentimiento

- **Anuncios limitados o ninguno:** no se usan cookies sin consentimiento, igual que la analítica (ADR-0028). Es la opción con menos ingresos.
- **Anuncios no personalizados:** dan más ingresos, pero usan cookies sin consentimiento fuera de la UE.
- **Ningún anuncio:** es lo más simple y lo que menos ingresos da.

## Decisión

1. **Red: Google AdSense** (opción A).
2. **Aprobación:** la cuenta se pide con el sitio público `acruxanime.com`. Una vez activada, se configura el acceso del rastreador a las pantallas con login de `app.acruxanime.com`.
3. **Pantallas con anuncios** (solo para usuarios gratuitos):
   - **Inicio** (`/`): un espacio entre secciones.
   - **Mi lista**: un espacio dentro de la lista, cada cierta cantidad de filas o al final.
   - **Ficha de franquicia**: un espacio debajo del detalle.
   - **Pantalla de tarjeta**: un espacio fuera de la tarjeta. Nunca va dentro de la tarjeta ni en la imagen exportada (RF-33).
4. **Pantallas sin anuncios:**
   - perfil público, inicio de sesión y borrado de cuenta (RN-05);
   - privacidad;
   - Perfil y Acerca de, por su poco contenido;
   - curaduría, que es interna;
   - pantallas de error y de carga.
5. **Consentimiento:**
   - Con consentimiento, se muestran anuncios personalizados.
   - Sin consentimiento, se muestran anuncios no personalizados.
   - En la UE, el Reino Unido y Suiza manda el CMP de Google con TCF. Si el usuario rechaza el almacenamiento, AdSense muestra anuncios limitados o ninguno.
6. **Plus** no carga el script de AdSense (RF-59).

## Consecuencias

- **Positivas:**
  - No hay umbral de tráfico.
  - El CMP certificado ya viene incluido para la UE, el Reino Unido y Suiza.
  - La lista de pantallas permitidas queda cerrada, así que agregar un espacio nuevo requiere actualizar esta ADR.
- **Negativas / riesgos:**
  - Fuera de la UE, el usuario que no acepta igual recibe cookies de AdSense (frecuencia y fraude). Esto se aparta del criterio de ADR-0028 para la analítica y debe quedar explicado en la política de privacidad.
  - La Ley 21.719 entra en vigencia el 1 de diciembre de 2026, según la [BCN](https://www.bcn.cl/balance-legislativo/detalle/ficha_LEY_21719_2024-12-13). Un proyecto de ley para postergarla a 2027 está en trámite: al 2026-11-08 lo aprobó el Senado y lo está viendo la Cámara. Antes de activar los anuncios hay que confirmar que estas cookies no necesitan consentimiento en Chile. Si lo necesitan, sin consentimiento se pasa a anuncios limitados o a ninguno.
  - Google puede rechazar o limitar la cuenta si el sitio público tiene poco contenido. Para eso hay que publicar contenido en `acruxanime.com` antes de pedir la aprobación.
  - El espacio en la pantalla de tarjeta compite con el momento de compartir. Hay que medir si baja la tasa de compartidos (RN-M2).
  - El script de AdSense afecta el rendimiento en el celular. Debe cargarse de forma diferida y respetar los RNF de rendimiento.
- **Acciones:**
  - Agregar AdSense a la política de privacidad, en español y en inglés, como encargado del tratamiento.
  - Extender el aviso de consentimiento a la publicidad: CMP de Google para la UE, el Reino Unido y Suiza; el banner propio para el resto.
  - Pedir la aprobación de AdSense solo después de recibir la autorización de AniList (#6), como exige ADR-0036, punto 4.
