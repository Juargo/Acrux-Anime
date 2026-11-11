# Requisitos de datos e integración

## 1. Integraciones externas

| ID | Servicio | Para qué | Prioridad | Hito |
|---|---|---|---|---|
| RDI-01 | **MyAnimeList (catálogo)** | Títulos, portadas, año, géneros, formato y relaciones entre entradas. Solo el servidor consulta su API (v2); un trabajo programado lo copia a la tabla `anime` de Neon y la API lo sirve al navegador (ADR-0043). Antes era AniList, consultado desde el navegador (ADR-0024). | Must | H2 |
| RDI-02 | **AniList (cuenta del usuario)** | Si la vincula: leer su lista y escribir lo que marca en Acrux. **Fuera del alcance del lanzamiento (2026-11-10, ADR-0043, punto 8).** | Should | — |
| RDI-03 | **Google (Neon Auth)** | Inicio de sesión. | Must | H2 |
| RDI-04 | *Retirado.* Apple | Se retira con el login solo con Google (ADR-0015). | — | — |
| RDI-05 | **Lemon Squeezy** | Venta de Plus vitalicio, reembolsos y pagos fallidos, mediante webhooks firmados. | Must | H4 |
| RDI-06 | **Hoja para compartir del navegador** | Destino de la tarjeta (Instagram, TikTok, galería…); descarga como alternativa. | Must | H2 |
| RDI-07 | **PostHog y Sentry** | Analítica con consentimiento y errores (ADR-0030). | Must | H1 |
| RDI-08 | ~~**Buttondown**~~ | *Retirado (ADR-0044).* Era la lista de espera de la landing; no llegó a tener correos. | Must | H1 |

## 2. Datos que Acrux guarda

| ID | Dato | Detalle | Personal | Tabla (ADR-0022) |
|---|---|---|---|---|
| RDI-10 | Cuenta | Identificador de la cuenta de Google y correo, en Neon Auth. | Sí | `neon_auth.user` |
| RDI-11 | Perfil | Nombre visible, avatar, idioma, idioma de los títulos, tema, lista pública o privada, modo del contador. | Sí | `profile` |
| RDI-12 | Vínculo con AniList | Cuenta de AniList vinculada y token cifrado. **Fuera del alcance del lanzamiento (2026-11-10, ADR-0043, punto 8).** | Sí | `anilist_link` |
| RDI-13 | Marcas | Por cada entrada marcada: id de MyAnimeList, estado (visto o viendo) y fecha. Las marcas anteriores a la migración guardaban el id de AniList; las que no se pudieron convertir quedan en `mark_anilist` y la API no las lee (ADR-0043, punto 6). | Sí | `mark` |
| RDI-14 | Plan | Plus vitalicio, fecha de compra y cliente de Lemon Squeezy. | Sí | `entitlement` |
| RDI-15 | Correcciones de franquicias | Tabla del curador con los IDs del agrupamiento corregido de las ~200 sagas, sin títulos ni portadas (DD-17, sujeto a confirmación de AniList; desde ADR-0043 los IDs son de MyAnimeList y los anteriores quedan en `franchise_override_anilist`). | No | `franchise_override` |
| RDI-16 | Métricas agregadas | Eventos de uso sin datos personales, en PostHog. | No | — |
| RDI-17 | Eventos de pago | Identificador de cada webhook procesado, para no procesarlo dos veces. | No | `billing_event` |
| RDI-18 | Reportes de sagas | Saga reportada y estado del reporte; el curador no ve quién reportó. | Sí (vínculo con el usuario) | Falta en ADR-0022 |
| RDI-19 | ~~Lista de espera~~ | *Retirado (ADR-0044).* La landing ya no registra correos. | Sí | Buttondown (ADR-0033) |

## 3. Datos que Acrux no guarda

| ID | Regla |
|---|---|
| RDI-20 | El catálogo de anime (títulos, portadas, descripciones). Se copia de MyAnimeList a la tabla `anime` y se sirve desde la API de Acrux (ADR-0043); antes se consultaba a AniList cuando hacía falta (RES-22). |
| RDI-21 | La lista completa de AniList del usuario como respaldo; solo lo necesario para mostrar y sincronizar (sin objeto mientras el vínculo con AniList esté fuera del alcance, ADR-0043). |
| RDI-22 | Datos de pago o tarjetas; los gestiona Lemon Squeezy. |

## 4. Reglas de datos

| ID | Regla | Prioridad |
|---|---|---|
| RDI-30 | La franquicia se arma con las relaciones de MyAnimeList (ADR-0043): secuelas y precuelas forman el núcleo; historias paralelas y resúmenes son extras; spin-offs y remakes son franquicias aparte; las entradas de música se ignoran. La tabla del curador siempre prevalece. Es una función pura de `packages/domain`. | Must |
| RDI-31 | Marcar una franquicia como vista marca todas las entradas de su núcleo, en una sola transacción. | Must |
| RDI-32 | El contador por franquicias cuenta franquicias con todo el núcleo visto; el contador por entradas cuenta cada entrada vista, de cualquier formato. | Must |
| RDI-33 | Con AniList vinculada, ambas listas se mantienen iguales. Al vincular, se combinan y gana "Vista" (DD-21); después, ante un conflicto, gana el cambio más reciente. **Fuera del alcance del lanzamiento (2026-11-10, ADR-0043, punto 8).** | Should |
| RDI-34 | Si el catálogo cambia (nueva temporada, entrada fusionada o eliminada), el usuario no pierde lo marcado y el total no baja (DD-03). | Must |
| RDI-35 | Borrar la cuenta elimina RDI-10 a RDI-14 y RDI-18, borra la persona en PostHog, revoca el vínculo con AniList y borra el cliente en Lemon Squeezy cuando sea posible. No borra nada en AniList. | Must |
| RDI-36 | El perfil público solo expone el nombre, el avatar, el contador y las marcas, y solo cuando la lista es pública. | Must |
| RDI-37 | La caché del catálogo en el navegador es solo en memoria; Figma propone 7 días (DD-17). Ver P-02. El catálogo de origen vive en la tabla `anime` de la API (ADR-0043). | Must |

## 5. Flujos de integración

1. **Primer ingreso:** inicia sesión con Google → declara su edad → Acrux crea la cuenta → carga en ráfaga de sagas populares → marca → crea su primera tarjeta. Vincular AniList se ofrecía y se podía omitir (fuera del alcance del lanzamiento, ADR-0043).
2. **Vincular AniList (fuera del alcance del lanzamiento, ADR-0043):** autoriza a Acrux en AniList (código de autorización intercambiado en la API) → Acrux trae su lista, la agrupa en franquicias y la combina con lo marcado (gana "Vista") → resumen de importación ("AniList tenía 214 entradas. En Acrux las agrupamos en 63 sagas.").
3. **Marcar:** marca en Acrux → actualización optimista → se guarda en la API → si tiene AniList, la escritura entra en una cola que respeta el límite (dónde corre la cola está pendiente, P-03; sin objeto mientras el vínculo esté fuera del alcance, ADR-0043).
4. **Comprar Plus:** checkout de Lemon Squeezy → webhook firmado → Acrux activa Plus. Lo mismo al fallar el pago o al reembolsarse.
5. **Borrar la cuenta:** reautenticación si la sesión supera 24 horas → aviso de pérdida de Plus → borrado en una transacción → confirmación.
