# Requisitos de datos e integración

## 1. Integraciones externas

| ID | Servicio | Para qué | Prioridad | Hito |
|---|---|---|---|---|
| RDI-01 | **AniList (catálogo)** | Títulos, portadas, año, géneros, formato y relaciones entre entradas. Se consulta desde el navegador; no se copia (ADR-0024). | Must | H2 |
| RDI-02 | **AniList (cuenta del usuario)** | Si la vincula: leer su lista y escribir lo que marca en Acrux. | Should | — |
| RDI-03 | **Google (Supabase Auth)** | Inicio de sesión. | Must | H2 |
| RDI-04 | *Retirado.* Apple | Se retira con el login solo con Google (ADR-0015). | — | — |
| RDI-05 | **Lemon Squeezy** | Venta de Plus, renovaciones, cancelaciones y pagos fallidos, mediante webhooks firmados. | Must | H4 |
| RDI-06 | **Hoja para compartir del navegador** | Destino de la tarjeta (Instagram, TikTok, galería…); descarga como alternativa. | Must | H2 |
| RDI-07 | **PostHog y Sentry** | Analítica con consentimiento y errores (ADR-0030). | Must | H1 |
| RDI-08 | **Buttondown** | Lista de espera: alta con doble confirmación, invitación a la beta y bajas (ADR-0033). | Must | H1 |

## 2. Datos que Acrux guarda

| ID | Dato | Detalle | Personal | Tabla (ADR-0022) |
|---|---|---|---|---|
| RDI-10 | Cuenta | Identificador de la cuenta de Google y correo, en Supabase Auth. | Sí | `auth.users` |
| RDI-11 | Perfil | Nombre visible, avatar, idioma, idioma de los títulos, tema, lista pública o privada, modo del contador. | Sí | `profile` |
| RDI-12 | Vínculo con AniList | Cuenta de AniList vinculada y token cifrado. | Sí | `anilist_link` |
| RDI-13 | Marcas | Por cada entrada marcada: id de AniList, id de MyAnimeList si existe, estado (visto o viendo) y fecha. | Sí | `mark` |
| RDI-14 | Plan | Plus anual o vitalicio, vigencia y cliente de Lemon Squeezy. | Sí | `entitlement` |
| RDI-15 | Correcciones de franquicias | Tabla del curador con los IDs del agrupamiento corregido de las ~200 sagas, sin títulos ni portadas (DD-17, sujeto a confirmación de AniList). | No | `franchise_override` |
| RDI-16 | Métricas agregadas | Eventos de uso sin datos personales, en PostHog. | No | — |
| RDI-17 | Eventos de pago | Identificador de cada webhook procesado, para no procesarlo dos veces. | No | `billing_event` |
| RDI-18 | Reportes de sagas | Saga reportada y estado del reporte; el curador no ve quién reportó. | Sí (vínculo con el usuario) | Falta en ADR-0022 |
| RDI-19 | Lista de espera | Correo de quien se registra en la landing de validación y estado de la confirmación. Se borra al terminar la beta. | Sí | Buttondown (ADR-0033) |

## 3. Datos que Acrux no guarda

| ID | Regla |
|---|---|
| RDI-20 | El catálogo de anime (títulos, portadas, descripciones). Se consulta a AniList cuando hace falta (RES-22). |
| RDI-21 | La lista completa de AniList del usuario como respaldo; solo lo necesario para mostrar y sincronizar. |
| RDI-22 | Datos de pago o tarjetas; los gestiona Lemon Squeezy. |

## 4. Reglas de datos

| ID | Regla | Prioridad |
|---|---|---|
| RDI-30 | La franquicia se arma con las relaciones de AniList: secuelas y precuelas forman el núcleo; historias paralelas y resúmenes son extras; spin-offs y remakes son franquicias aparte; las entradas de música se ignoran. La tabla del curador siempre prevalece. Es una función pura de `packages/domain`. | Must |
| RDI-31 | Marcar una franquicia como vista marca todas las entradas de su núcleo, en una sola transacción. | Must |
| RDI-32 | El contador por franquicias cuenta franquicias con todo el núcleo visto; el contador por entradas cuenta cada entrada vista, de cualquier formato. | Must |
| RDI-33 | Con AniList vinculada, ambas listas se mantienen iguales. Al vincular, se combinan y gana "Vista" (DD-21); después, ante un conflicto, gana el cambio más reciente. | Should |
| RDI-34 | Si el catálogo cambia (nueva temporada, entrada fusionada o eliminada), el usuario no pierde lo marcado y el total no baja (DD-03). | Must |
| RDI-35 | Borrar la cuenta elimina RDI-10 a RDI-14 y RDI-18, borra la persona en PostHog, revoca el vínculo con AniList y cancela la suscripción en Lemon Squeezy. No borra nada en AniList. | Must |
| RDI-36 | El perfil público solo expone el nombre, el avatar, el contador y las marcas, y solo cuando la lista es pública. | Must |
| RDI-37 | La caché del catálogo en el navegador es solo en memoria (ADR-0024); Figma propone 7 días (DD-17). Ver P-02. | Must |

## 5. Flujos de integración

1. **Primer ingreso:** inicia sesión con Google → declara su edad → Acrux crea la cuenta → carga en ráfaga de sagas populares → marca → crea su primera tarjeta. Vincular AniList se ofrece y se puede omitir.
2. **Vincular AniList:** autoriza a Acrux en AniList (código de autorización intercambiado en la API) → Acrux trae su lista, la agrupa en franquicias y la combina con lo marcado (gana "Vista") → resumen de importación ("AniList tenía 214 entradas. En Acrux las agrupamos en 63 sagas.").
3. **Marcar:** marca en Acrux → actualización optimista → se guarda en la API → si tiene AniList, la escritura entra en una cola que respeta el límite (dónde corre la cola está pendiente, P-03).
4. **Comprar Plus:** prueba el tema en su tarjeta → elige plan → checkout de Lemon Squeezy → webhook firmado → Acrux activa Plus. Lo mismo al renovar, fallar el pago, cancelar o vencer.
5. **Borrar la cuenta:** reautenticación si la sesión supera 24 horas → aviso de suscripción → borrado en una transacción → confirmación.
