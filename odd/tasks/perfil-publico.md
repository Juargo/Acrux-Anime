# Feature: public profile by link (issue #37, plus the QR and the make-public offer of #36)

Objective: every user gets an automatic `@handle`; `app.acruxanime.com/@handle` shows, without an account, the name, avatar, handle and total (Figma M15), plus "Viendo ahora" and the most recent sagas when the list is public (M14); social networks get an Open Graph preview; the owner switches the list between private and public (M17); the card carries the link and a QR, and the first share with a private list offers to make it public.
Branch: `feat/perfil-publico` · Delivery: `single-pr` (as #35 and #36) · Test runner: vitest (`apps/api` with supertest and Testcontainers, `apps/web` with Testing Library on jsdom).

## Specs

- S1 (issue #37): "`GET /api/v1/profiles/{handle}` público; 404 si la lista es privada". RF-40: "Cada usuario tiene un perfil público accesible por enlace, sin cuenta, con vista previa para redes (imagen Open Graph)." RF-43: "No existe búsqueda ni listado de perfiles de otros usuarios." As decided in L4, the profile route answers the summary (name, avatar, handle, total, visibility) for private lists too, and the list of marks answers `404` while the list is private; an unknown handle answers `404`.
- S2 (issue #37): "Página pública con contador, vistos y viendo ahora". RF-41: "El perfil público muestra el contador, la lista de vistos y la de viendo ahora." Figma M14 (37:2361): "VIENDO AHORA", "SAGAS MÁS RECIENTES", "Crear mi tarjeta", "¿Y tú, cuántos has visto?", "Crea tu tarjeta gratis"; M15 (37:2401): "Jorge mantiene su lista privada" / "Solo se muestra su total.". RNF-52: "El perfil público se ve bien en el navegador del celular y genera una vista previa en redes."
- S3 (issue #37): "Imagen Open Graph del perfil con `@vercel/og` (solo nombre, avatar y contador)". ADR-0026: "se resuelve con una función de imagen Open Graph en la API". The counter is the owner's last counter (L3).
- S4 (issue #37): "`Cache-Control: public, s-maxage` corto", overridden by L2: the profile and the list are `no-store`; only the Open Graph image gets a short `s-maxage`.
- S5 (issue #37): "Interruptor público/privado en el perfil (RF-42)". RF-42: "La lista es **privada por defecto**. Si es privada, el enlace no muestra la lista y la API responde `404`. Al pasarla a privada, el visitante deja de verla de inmediato." Figma M17 (40:2435): "¿Quién ve tu lista?" / "Tu total siempre se ve en tu tarjeta y tu enlace." / "Privada" "Quien abra tu enlace solo verá tu total." / "Pública" "Verán tu total, lo que estás viendo y tus sagas más recientes." / "ASÍ TE VE UN VISITANTE" / "Listo, guardado.".
- S6 (issue #37): "Evento `public_profile_viewed`", through an optional callback until PostHog (#46); ADR-0030 also names `list_made_public`.
- S7 (acceptance, @CA-RF40-01): "Dado que la lista de Camila es pública / Cuando un visitante sin cuenta abre su enlace / Entonces ve su contador, sus vistos y lo que está viendo ahora".
- S8 (acceptance, @CA-RF42-01, rewritten by L5): given Camila's list is private, when a visitor opens her link, then they see her name, avatar, handle and total and "Camila mantiene su lista privada", and nothing of her list; an unknown handle shows "perfil no disponible".
- S9 (stakeholder decision L1): "Automatic from name (Recommended)": the handle is generated once from the display name ("Jorge" → @jorge, then @jorge2 if taken), unique, editable later with #39.
- S10 (#36, RF-32): "La tarjeta lleva una marca discreta de Acrux y un enlace o QR al perfil público." The card shows `@handle` and the link, with a QR to it.
- S11 (#36, @CA-RF30-02): "Dado que mi lista es privada y nunca compartí una tarjeta / Cuando comparto mi primera tarjeta / Entonces la app me ofrece hacer pública mi lista para que el QR muestre mi perfil".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S5, S9, S3, S11 | inline | pending | Migration: `handle` (unique), `shown_total` and `shown_mode` (the owner's last counter), `card_shared_at`; handle assigned on the profile's first request (and for existing profiles on their next one); `GET /me` returns them; `PATCH /me` accepts `listVisibility`, the shown counter and the first share. |
| T2 | S1, S4, S6 | inline | pending | `GET /api/v1/profiles/{handle}` (summary) and `GET /api/v1/profiles/{handle}/marks` (404 while private), public, 60/min per IP, `no-store`, OpenAPI. |
| T3 | S3, S4 | inline | pending | Open Graph image `GET /api/v1/profiles/{handle}/og.png` with `@vercel/og` and a share page with the meta tags for crawlers of `/@handle`. |
| T4 | S2, S6, S7, S8 | inline | pending | `/@handle` outside the session gate: M14 and M15, "perfil no disponible". |
| T5 | S5, S10, S11, S3 | inline | pending | Owner side: the counter saves the shown total, M17 privacy screen, `@handle`, link and QR on the card, first-share offer. |

Route evidence: one feature in dependent deliveries (schema and API, then the public page, then the owner side); no writer trigger holds.

## Log

- L1 (2026-11-04, stakeholder): "vamos" (start #37 after #36 merged); handle: "Automatic from name (Recommended)".
- L2 (2026-11-04, stakeholder): cache: "Privacy first (Recommended)".
- L3 (2026-11-04, stakeholder): Open Graph counter: "Owner's last counter (Recommended)".
- L4 (2026-11-04, stakeholder): private profile: "Like Figma: total only (Recommended)".
- L5 (2026-11-04, assumptions): @CA-RF42-01, RF-42 and ADR-0025 are rewritten to match L4. Handle: lowercase `a-z`, `0-9` and `_`, 3 to 20 characters, from the display name without accents; "usuario" when nothing is left; reserved words (routes and brand) are skipped; a number is appended on a clash (`jorge2`, `jorge3`). The public URL is `<origin>/@handle`. "Sagas más recientes" are the complete franchises, newest first, up to 6 (what the owner's "Vistas" shows by franchises). The privacy screen lives at `/privacidad` (Perfil, M16, comes with #39) and is reached from the card. `public_profile_viewed` and `list_made_public` go through optional callbacks, without personal data.
