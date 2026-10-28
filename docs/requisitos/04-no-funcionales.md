# Requisitos no funcionales

Las metas numéricas son **iniciales** (decisión del 26-oct: sin metas hasta tener datos) y salen de los indicadores técnicos de ADR-0030. Se ajustan con los datos de la beta.

## Usabilidad

| ID | Requisito | Prioridad | Meta |
|---|---|---|---|
| RNF-01 | Marcar una franquicia requiere un solo clic o toque desde el catálogo. | Must | — |
| RNF-02 | Un usuario nuevo genera y comparte su primera tarjeta rápidamente. | Must | < 3 min (RN-M1) |
| RNF-03 | Interfaz simple, sin opciones avanzadas a la vista. | Must | — |
| RNF-04 | Web responsive pensada primero para el celular; el mismo flujo en celular y escritorio. | Must | — |
| RNF-05 | Textos en español nativo; inglés como segundo idioma. | Must | — |
| RNF-06 | Accesibilidad básica: respeta el tamaño de texto del navegador, contraste suficiente y etiquetas para lectores de pantalla. | Should | Por definir |

## Rendimiento

| ID | Requisito | Prioridad | Meta inicial |
|---|---|---|---|
| RNF-10 | La búsqueda y los filtros responden de forma fluida. | Must | Core Web Vitals en móvil: LCP < 2,5 s; INP < 200 ms; CLS < 0,1 |
| RNF-11 | Marcar y actualizar el contador se percibe instantáneo (actualización optimista). | Must | p95 de escritura de marcas < 300 ms |
| RNF-12 | La tarjeta se genera sin espera notoria. | Must | Por definir |

## Disponibilidad y conectividad

| ID | Requisito | Prioridad | Meta inicial |
|---|---|---|---|
| RNF-20 | La app requiere conexión; no hay modo sin conexión. La PWA solo cachea la estructura de la app. | Must | — |
| RNF-21 | Sin conexión, o si AniList no responde o limita las peticiones, la app lo informa con un mensaje claro y no pierde lo marcado. | Must | — |
| RNF-22 | El perfil público está disponible aunque el usuario no tenga la app abierta. | Must | `/api/health` ≥ 99,5 % mensual |
| RNF-23 | Tasa de errores 5xx de la API baja. | Must | < 1 % |

## Seguridad y privacidad

| ID | Requisito | Prioridad | Meta |
|---|---|---|---|
| RNF-30 | Se guardan solo los datos personales mínimos (identidad, nombre visible, avatar, marcas y preferencias). El correo nunca se muestra. | Must | — |
| RNF-31 | El visitante nunca ve datos que el usuario no haya hecho públicos. | Must | — |
| RNF-32 | El token de AniList se usa solo para sincronizar, se guarda cifrado y se elimina al desvincular o borrar la cuenta. | Must | — |
| RNF-33 | Borrar la cuenta elimina los datos personales de inmediato en la base, en PostHog y el vínculo con AniList; en los respaldos, al expirar estos. | Must | Respaldos: a más tardar 30 días (ADR-0032) |
| RNF-34 | Política de privacidad pública, con encargados del tratamiento, plazos y derechos, accesible desde la landing y la app. | Must | — |
| RNF-35 | Cumplimiento de la Ley 21.719 de Chile y de GDPR en su versión básica. | Must | — |
| RNF-36 | Los pagos los gestiona Lemon Squeezy; Acrux no maneja datos de tarjetas. | Must | — |
| RNF-37 | Autorización denegada por defecto; aislamiento entre usuarios verificado con pruebas. | Must | ADR-0025, ADR-0029 |
| RNF-38 | Analítica solo con consentimiento; los eventos nunca llevan datos personales. | Must | ADR-0028, ADR-0030 |

## Confiabilidad de los datos

| ID | Requisito | Prioridad | Meta |
|---|---|---|---|
| RNF-40 | Lo que el usuario marca no se pierde ni se duplica, tampoco al sincronizar con AniList. | Must | — |
| RNF-41 | El agrupamiento de las sagas más populares es correcto. | Must | Cobertura del top 200 por definir |
| RNF-42 | El contador siempre coincide con la lista visible, y los cambios del catálogo nunca le restan (DD-03). | Must | — |

## Compatibilidad

| ID | Requisito | Prioridad | Meta |
|---|---|---|---|
| RNF-50 | Funciona en navegadores modernos de celular y escritorio (Chromium y WebKit). Instalable como PWA. | Must | Versiones mínimas por definir |
| RNF-51 | La tarjeta se ve bien en Instagram Stories y TikTok (9:16). | Must | — |
| RNF-52 | El perfil público se ve bien en el navegador del celular y genera una vista previa en redes. | Must | — |

## Escalabilidad y costo

| ID | Requisito | Prioridad | Meta |
|---|---|---|---|
| RNF-60 | Las consultas a AniList respetan su límite aunque crezca la cantidad de usuarios (consultas por lotes, caché en memoria, reintento ante `429`). | Must | `429` por sesión cercano a 0 |
| RNF-61 | Los costos de operación son compatibles con un proyecto indie. | Should | US$0 en H1 y H2 (ADR-0026) |

## Mantenibilidad

| ID | Requisito | Prioridad | Meta |
|---|---|---|---|
| RNF-70 | Lo puede mantener una sola persona. | Must | — |
| RNF-71 | Agregar un idioma no requiere cambios en la lógica. | Should | — |
| RNF-72 | Las reglas de dominio (franquicias, contador, plan) están aisladas y probadas. | Must | Cobertura ≥ 90 % en `packages/domain` (ADR-0029) |
