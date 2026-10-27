# ADR-0028: Seguridad y privacidad desde el diseño y por defecto

- **Estado:** Aceptado
- **Fecha:** 2026-10-27
- **Participantes:** Jorge (stakeholder, Product Owner y desarrollador), Claude (analista)
- **Origen:** Sesión con el stakeholder, 2026-10-27 (alcance: ley chilena + GDPR básico). Requisitos RNF-30 a RNF-36.

## Contexto

Acrux maneja datos personales (identidad de Google, nombre, avatar, lista), un token de una cuenta de terceros (AniList) y pagos (vía Lemon Squeezy). Un fallo costaría la confianza del usuario, la autorización de AniList o una sanción.

- **Marco legal:** ley chilena de protección de datos personales (Ley 21.719, que reemplaza a la Ley 19.628) y **GDPR en su versión básica**, porque puede haber usuarios en España y en Europa (decisión del 2026-10-27).
- **Presupuesto cercano a cero:** las medidas deben ser gratuitas o venir incluidas en la plataforma.

## Opciones consideradas

| Opción | Comentario |
|---|---|
| **Seguridad y privacidad desde el diseño, con controles incluidos en la plataforma** | Amenazas modeladas desde el inicio; valores por defecto seguros; costo cero. |
| Agregar seguridad antes del lanzamiento | Más barato hoy; corregir el diseño después cuesta más y queda deuda. |
| Solo ley chilena | Menos trabajo, pero excluye a usuarios europeos o los expone sin garantías. |

## Decisión

### Modelo de amenazas (STRIDE, versión corta)

| Amenaza | Ejemplo en Acrux | Control |
|---|---|---|
| Suplantación | JWT falsificado | Firma verificada con JWKS, `iss`, `aud` y expiración (ADR-0025) |
| Manipulación | Webhook de pago falso | Firma HMAC verificada e idempotencia (ADR-0025) |
| Acceso a datos ajenos (IDOR) | Leer las marcas de otro usuario | `user_id` solo del JWT; repositorios con `userId` obligatorio; pruebas de aislamiento (ADR-0029) |
| Divulgación | Perfil privado expuesto; token de AniList en logs | `404` en listas privadas; token cifrado; logs sin datos personales (ADR-0030) |
| Denegación de servicio | Abuso de la API o de AniList desde Acrux | Límite de peticiones en la API; consultas por lotes al catálogo (ADR-0024) |
| Elevación de privilegios | Volverse Plus o curador desde el cliente | Plan y rol solo desde el servidor (ADR-0025) |
| XSS | Robo de la sesión de Supabase | CSP estricta; React sin `dangerouslySetInnerHTML`; datos de AniList validados |

### Seguridad desde el diseño

1. **Denegado por defecto:** rutas privadas salvo que se marquen como públicas; RLS activado sin políticas y Data API desactivada en `public` (ADR-0022, ADR-0025).
2. **Mínimo privilegio:** rol de base de datos propio para la API; la clave `service_role` se usa solo en el borrado de cuenta; permisos mínimos en GitHub Actions (ADR-0027).
3. **Toda entrada se valida con Zod:** las peticiones a la API y también las respuestas de AniList y los webhooks.
4. **Secretos** solo en variables de entorno de Vercel y GitHub, separados por entorno; gitleaks en CI. En el navegador solo existe la clave anónima de Supabase.
5. **Cabeceras de seguridad** en Vercel:
   - `Content-Security-Policy`: `default-src 'self'`; `connect-src` limitado a la API, Supabase, `graphql.anilist.co`, PostHog y Sentry; `img-src` limitado al CDN de AniList, los avatares de Google y `data:`; `frame-ancestors 'none'`.
   - `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` restrictiva.
6. **Límite de peticiones** en la API por usuario y por IP. Las rutas de escritura y el perfil público se protegen primero.
7. **Cadena de suministro:** lockfile, Dependabot, `pnpm audit`, Semgrep y acciones fijadas por SHA (ADR-0027).

### Privacidad por defecto

1. **Datos mínimos** (RNF-30): solo los de RDI-10 a RDI-14. Del perfil de Google se toman el nombre y el avatar; el correo no se muestra nunca.
2. **Lista privada por defecto** (decisión del 2026-10-27). El usuario la hace pública de forma explícita. Al compartir la tarjeta por primera vez, la app le ofrece hacerla pública.
3. **Analítica solo con consentimiento:** PostHog funciona sin cookies ni identificadores persistentes hasta que el usuario acepta; sin captura automática de campos de texto (ADR-0030).
4. **Derechos del titular:**
   - Acceso y portabilidad: `GET /api/v1/me/export` (JSON).
   - Rectificación: edición del perfil (RF-07).
   - Supresión: `DELETE /api/v1/me` borra los datos de Acrux, la persona en PostHog y el vínculo con AniList (RDI-35). **Plazo:** inmediato en la base de datos; en los respaldos, al expirar estos (4 semanas). Responde la pregunta abierta de RNF-33.
   - Oposición: retirar el consentimiento de analítica en cualquier momento.
5. **Encargados del tratamiento** (todos con acuerdo de procesamiento de datos y cláusulas contractuales tipo para transferencias internacionales): Supabase, Vercel, PostHog, Sentry, Lemon Squeezy y Cloudflare (respaldos). Se listan en la política de privacidad.
6. **Región:** base de datos y funciones en São Paulo (`sa-east-1` y `gru1`, ADR-0020). PostHog en su nube de la UE.
7. **Respaldo cifrado** en un bucket privado, con retención de 4 semanas (ADR-0022); los datos borrados desaparecen de los respaldos cuando estos expiran, y la política de privacidad lo informa.

## Consecuencias

- **Positivas:** los controles forman parte del diseño desde el primer commit; cumplimiento razonable de la ley chilena y de GDPR sin costo adicional.
- **Negativas / riesgos:**
  - Lista privada por defecto puede reducir la cantidad de perfiles públicos, el motor viral (RN-03). Se mitiga con la invitación al compartir.
  - El límite de peticiones en funciones serverless necesita un almacén compartido (ver preguntas abiertas).
- **Acciones derivadas:**
  - Redactar la política de privacidad en la landing, con encargados, plazos y derechos (RES-34).
  - Configurar las cabeceras de seguridad en `vercel.json`.
  - Banner de consentimiento de analítica en la web y en la landing.
  - Elegir el almacén del límite de peticiones al implementar la API: Upstash Redis (capa gratuita) o reglas del firewall de Vercel.

