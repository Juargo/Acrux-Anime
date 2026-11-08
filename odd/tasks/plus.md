# Lifetime Plus purchase with Lemon Squeezy (epic #50, Plus block)

Objective: a user buys lifetime Plus through a Lemon Squeezy checkout created by the API. A signed, idempotent webhook grants Plus or takes it back on a refund. `requirePlan('plus')` reads the plan from the database, and the web shows the plan in Perfil. The whole feature stays off until the billing env vars are set (ADR-0036 point 4: no charging before the AniList licence).
Branch: `feat/plus`. Delivery: single-pr (same as #42, #43 and #47; commits split by work unit). Test runner: vitest (`pnpm --filter @acrux/api test`, `pnpm --filter @acrux/web test`), Testcontainers for repositories, Playwright for the E2E journey.

## Specs

- **S1** (epic #50): "Producto vitalicio en Lemon Squeezy (precio regional para Latinoamérica)". The product and its regional price are configured in the Lemon Squeezy store. The API only needs the store and variant IDs.
- **S2** (epic #50): "`POST /api/v1/billing/checkout` con el `user_id` en los datos personalizados". ADR-0025: "El checkout lo crea la API con el `user_id` en los datos personalizados".
- **S3** (epic #50): "Webhook con firma HMAC, idempotencia por `event_id` y `entitlement` en una transacción". ADR-0025: "El webhook verifica la firma HMAC (`X-Signature`) antes de leer el cuerpo, descarta eventos repetidos (`billing_event`) y actualiza `entitlement` en una transacción". Path (ADR-0023): `POST /api/v1/webhooks/lemon-squeezy`.
- **S4** (epic #50): "Reembolso: vuelve a gratuito y conserva lista, total y tarjetas (RF-56)". RF-56: "Plus no vence. Si se reembolsa la compra, el usuario vuelve a ser gratuito y conserva su lista, su total y sus tarjetas."
- **S5** (epic #50): "Plus quita los anuncios en cualquier dispositivo donde inicie sesión (RF-51, RF-59)". There are no ads yet, so in this feature S5 means: the plan lives in the account and every device reads it from `GET /api/v1/me`.
- **S6** (epic #50): "`requirePlan('plus')` en las funciones Plus: temas y plantillas de tarjeta, estadísticas avanzadas, Wrapped, insignias (RF-52 a RF-55)". None of those features exist yet. This feature ships the guard and its tests; each Plus feature applies it when it is built.
- **S7** (epic #50): "Confirmación, error de pago, pago pendiente y plan en Ajustes (RF-57)". Screens M22–M25/D22–D25 in Figma.
- **S8** (epic #50): "Eventos `plus_checkout_started` y `plus_purchased`".
- **S9** (epic #50, acceptance): "Un webhook repetido no duplica el plan".
- **S10** (epic #50, acceptance): "El estado de Plus nunca se toma del cliente".
- **S11** (stakeholder, 2026-11-08): "Quedaría apagado detrás de un interruptor, así cuando llegue la licencia solo hay que prenderlo."
- Assumption A1: the switch follows the existing convention, where an unset env var means the feature answers 503 (as `NEON_API_KEY` does for `DELETE /me`). Billing is on only when `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, `LEMON_SQUEEZY_VARIANT_ID` and `LEMON_SQUEEZY_WEBHOOK_SECRET` are all set. `/me` tells the web whether buying is available, so the web hides the purchase entry while billing is off.
- Assumption A2: Lemon Squeezy webhooks carry no unique event id. The payload has only `meta.event_name`, `meta.custom_data` and the resource. The idempotency key stored in `billing_event.event_id` is therefore `<event_name>:<order id>`. An order is created once and refunded once (https://docs.lemonsqueezy.com/help/webhooks/webhook-requests).
- Assumption A3: `order_created` with `status: "paid"` grants `plus_lifetime`. `order_refunded` with `refunded: true` (a full refund) removes the entitlement. A partial refund keeps Plus. Orders with status `pending`, `failed` or `fraudulent` grant nothing.
- Assumption A4: the `plan` enum value `plus_annual` is removed in a migration. ADR-0036 retired the annual plan, and no purchase has ever been possible, so no row can hold it.
- Assumption A5: `entitlement` gains `lemon_squeezy_order_id` (to match a refund to its purchase) and `purchased_at` (RDI-14 "fecha de compra").

## Tasks

| ID | Specs | Task | Route | Status | Evidence |
|---|---|---|---|---|---|
| T1 | S3, S4, A4, A5 | Migration: drop `plus_annual`, add `lemon_squeezy_order_id` and `purchased_at`; entitlement repository with grant/revoke in one transaction with `billing_event` | inline; Risk item 1 (migration) | done | 20b34e1; RED missing module, GREEN API 282/282, no schema drift |
| T2 | S2, S11, A1 | Billing env vars, Lemon Squeezy checkout adapter, `POST /api/v1/billing/checkout` | inline | done | RED missing module + 6 failing, GREEN API 295/295 |
| T3 | S3, S4, S9, A2, A3 | `POST /api/v1/webhooks/lemon-squeezy`: raw body, HMAC check, Zod payload, idempotent apply | inline; Risk item 2 (guard) | done | RED 17 failing, GREEN API 312/312, depcruise clean |
| T4 | S5, S6, S10 | `requirePlan('plus')` reading the database; `plan` and `plusAvailable` in `/me` | inline; Risk item 2 (guard) | done | RED 8 failing, GREEN API 322/322 |
| T5 | S7, S8 | Web: plan row and Plus screen in Perfil, checkout redirect, return states, events | inline | pending | |
| T6 | all | ADR-0025 note on the idempotency key, billing runbook, OpenAPI, Gherkin RF-50/RF-56/RF-57, E2E | inline | pending | |

## Log

- **L1** (2026-11-08, user): "con compra plus"
- **L2** (2026-11-08): the scope agreed in the previous turn was "compra de Plus en H4: checkout en Lemon Squeezy, webhook con firma e idempotencia, y `requirePlan('plus')`. Quedaría apagado detrás de un interruptor".
- **L3** (2026-11-08): the explorer mapped the code. The `entitlement` and `billing_event` tables already exist (initial migration), the `billing` module has no routes, and `express.json` parses every body globally (`apps/api/src/app.ts:16`), so the webhook needs the raw body. Lemon Squeezy docs checked: `X-Signature` is an HMAC-SHA256 hex digest of the raw body, `X-Event-Name` names the event, a non-200 reply is retried up to three more times, and there is no event id (A2).
- **L4** (2026-11-08): forecast of about 1,300 authored lines. Delivery is single-pr, as in the earlier features. T1, T3 and T4 get their own commits because they name high-risk items.
