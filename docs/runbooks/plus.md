# Plus vitalicio con Lemon Squeezy

Compra de Plus vitalicio (épica #50, ADR-0025, ADR-0036). Plus es un pago único: no hay renovación, cancelación ni período de gracia.

## Qué hace

- **`POST /api/v1/billing/checkout`:** crea un checkout de Lemon Squeezy para la variante de Plus.
  - El `user_id` va en `checkout_data.custom` y sale de la sesión. La API no lee el cuerpo de la petición.
  - Responde `{ url }`, y la app abre esa página.
  - Responde 409 `billing.already_plus` a quien ya tiene Plus.
  - Si Lemon Squeezy falla, responde 502 `billing.provider_error` y reporta el error a Sentry.
  - Al terminar el pago, Lemon Squeezy devuelve al usuario a `BILLING_RETURN_URL?compra=lista`.
- **`POST /api/v1/webhooks/lemon-squeezy`:** es pública. La autentica la firma.
  1. Verifica `X-Signature`, el HMAC-SHA256 en hexadecimal del cuerpo crudo, antes de leerlo. Si no coincide, responde 401 `billing.invalid_signature`.
  2. Valida el evento con Zod. Si no es válido, responde 400 `billing.invalid_payload`.
  3. Aplica el evento:
     - Un `order_created` con estado `paid` de la tienda y la variante configuradas da `plus_lifetime`.
     - Un `order_refunded` con `refunded: true` quita Plus solo si esa orden lo dio. El perfil, la lista y las tarjetas se conservan (RF-56).
     - Todo lo demás responde 200 `ignored`: otros eventos, órdenes `pending`, `failed` o `fraudulent`, reembolsos parciales y otras tiendas o variantes.
  4. Registra el evento en `billing_event` y cambia `entitlement` en una sola transacción. Un evento repetido responde 200 `duplicate` y no cambia nada.
- **Idempotencia:** Lemon Squeezy no manda un id de evento, así que la clave es `<evento>:<id de la orden>` (por ejemplo `order_created:1001`). Cada orden se crea una vez y se reembolsa una vez.
- **`requirePlan('plus')`:** una ruta con `plan: 'plus'` lee el plan de `entitlement` en cada petición y responde 403 `plan.plus_required` a quien no lo tiene. El plan nunca se toma del cliente ni del JWT. Por ahora ninguna ruta lo usa: cada función de Plus (RF-52 a RF-55) lo aplica cuando se construye.
- **`GET /api/v1/me`:** trae `plan` (`free` o `plus`, leído de la base) y `plusAvailable`, que indica si se puede comprar en este entorno.
- **En la app** (Perfil → Acrux Plus, `/perfil/plus`): pantallas de Figma M21–M24, adaptadas al pago único.
  - Ofrece el pago único y abre el checkout. Si no se pudo iniciar, avisa que no se cobró nada.
  - Al volver del pago, consulta `/me` cada 2 segundos, hasta un minuto. Si el webhook dio Plus, muestra «¡Ya eres Plus!»; si no, avisa que el pago se está confirmando.
  - Con Plus, muestra «Plus vitalicio · Activo».
  - Envía `plus_checkout_started` y `plus_purchased`, sin monto ni orden.

## Interruptor

La facturación queda **apagada** mientras falte cualquiera de las cuatro variables `LEMON_SQUEEZY_*`. En ese caso:

- las dos rutas responden 503 `billing.unavailable` y no se cobra nada;
- `/me` da `plusAvailable: false`, y Perfil oculta la fila de Plus a los usuarios gratuitos.

Un plan ya comprado se sigue leyendo de la base aunque la facturación esté apagada. Plus no se activa en producción antes de la licencia comercial de AniList (ADR-0036, punto 4).

## Configuración

En el proyecto `app` de Vercel, todas marcadas como *Sensitive*:

| Variable | Production | Preview |
|---|---|---|
| `LEMON_SQUEEZY_API_KEY` | API key de la tienda en modo real | API key en modo de prueba (*Test mode*) |
| `LEMON_SQUEEZY_STORE_ID` | id numérico de la tienda | el mismo |
| `LEMON_SQUEEZY_VARIANT_ID` | id numérico de la variante «Plus vitalicio» | el de modo de prueba |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | secreto de firma del webhook de producción, de 16 a 40 caracteres (Lemon Squeezy no acepta más de 40; por ejemplo `openssl rand -hex 16`) | el del webhook de prueba |
| `BILLING_RETURN_URL` | opcional; por defecto `https://app.acruxanime.com/perfil/plus` | la URL `/perfil/plus` de la vista previa |

En Lemon Squeezy:

1. Crea el producto «Acrux Plus» con una variante de **pago único**. El precio de referencia es ~US$19,99, con precio regional para Latinoamérica (S1). El precio se configura solo en la tienda.
2. En **Settings → Webhooks**, crea un webhook:
   - URL: `https://app.acruxanime.com/api/v1/webhooks/lemon-squeezy`
   - Eventos: `order_created` y `order_refunded`
   - Un secreto propio, el mismo que va en `LEMON_SQUEEZY_WEBHOOK_SECRET`
3. Repite el paso 2 en modo de prueba, con la URL de la vista previa.
4. Vuelve a desplegar: la API lee las variables al arrancar.

## Comprobar

- Con la facturación encendida en una vista previa, en Perfil aparece la fila Acrux Plus con «Gratis».
- Compra con una tarjeta de prueba de Lemon Squeezy. Al volver, la app debe mostrar «¡Ya eres Plus!» y la fila debe decir «Activo».
- En Lemon Squeezy, **Settings → Webhooks** muestra cada entrega con la respuesta de la API (`applied`, `duplicate`, `ignored`, …).
- Reembolsa la orden desde Lemon Squeezy: el plan vuelve a «Gratis» y la lista sigue igual.

## Casos a tener en cuenta

- **Cuenta borrada antes del webhook:** el evento se registra y responde `unknown_user`. Esa orden ya no puede dar Plus, aunque la cuenta vuelva a crearse. Se resuelve a mano, con un reembolso o dando Plus por SQL.
- **Dos órdenes pagadas para la misma persona** (por ejemplo, dos checkouts abiertos a la vez antes del 409): la segunda reemplaza el id de orden guardado. Si se reembolsa la primera, Plus no se quita; si se reembolsa la segunda, Plus se quita aunque la primera siga pagada. Hay que revisarlo a mano.
- **Reembolso que llega antes que la orden:** la orden posterior responde `refunded` y no da Plus.
- **Una entrega rechazada** (401, 400, 503 o 500) no escribe nada. Lemon Squeezy la reintenta hasta tres veces más (a los 5, 25 y 125 segundos).
- **Borrado de cuenta:** borra el plan en cascada. El cliente de Lemon Squeezy sigue existiendo (pendiente de #50; ver `borrado-de-cuenta.md`).
