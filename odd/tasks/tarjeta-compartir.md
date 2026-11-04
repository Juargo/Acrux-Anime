# Feature: vertical share card (issue #36)

Objective: a "Tarjeta" screen (Figma M05 29:313, M07 29:422) asks "¿Qué estás viendo ahora?", shows the 9:16 card with the total, name, avatar and covers of what the user is watching, and shares it with the Web Share API or downloads it; reached from the navigation bar.
Branch: `feat/tarjeta-compartir` · Delivery: `single-pr` · Test runner: vitest (`apps/web` with Testing Library on jsdom).

## Specs

- S1 (issue #36): "Tarjeta 9:16 con total, nombre, avatar y portadas de lo que está viendo ahora". RF-30: "El usuario genera una tarjeta vertical 9:16 con su total, nombre, avatar y portadas de lo que está viendo ahora. Justo antes se le pregunta "¿Qué estás viendo ahora?" (se puede saltar)." RNF-51: "La tarjeta se ve bien en Instagram Stories y TikTok (9:16)." Figma M05: "¿Qué estás viendo ahora?" / "Aparecerá en tu tarjeta. Es opcional." / "Saltar" / "Continuar (2)"; M07: "Tu tarjeta", "ANIMES COMPLETOS", "VIENDO AHORA", "Compartir", "Descargar imagen".
- S2 (issue #36): "Generación en el navegador con `html-to-image` (o la alternativa definida en el spike)". ADR-0024: "**La tarjeta puede generarse en el cliente**; no hace falta un proxy de imágenes ni renderizar en el servidor." RNF-12: "La tarjeta se genera sin espera notoria."
- S3 (issue #36): "Web Share API con descarga como alternativa; probar en iOS Safari y Android Chrome". RF-31: "La tarjeta se comparte con la hoja del navegador (Web Share API) cuando existe; si no, se descarga la imagen."
- S4 (issue #36, partial): "Marca discreta de Acrux" (RF-32). The QR to the public profile joins with #37 (stakeholder decision L2).
- S5 (issue #36): "Eventos `card_generated` y `card_shared`; sin anuncios nunca (RF-33)". The events go through optional callbacks until PostHog arrives (#46), as in `odd/tasks/marcar-franquicia.md`.
- S6 (acceptance, @CA-RF30-01): "Dado que inicié sesión y marqué franquicias / Cuando toco "Compartir tarjeta" / Entonces se genera una imagen vertical con mi total, mi nombre, mi avatar y lo que estoy viendo / Y puedo enviarla a otra app o guardarla en la galería".
- Out of scope (L2): QR, "Al compartir por primera vez con la lista privada, ofrecer hacerla pública (ADR-0028)" and @CA-RF30-02 join with #37.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S4 | inline | pending | `ShareCard` with props (the sign-in sample reuses it) and `shareCardContent` (total and label by counter mode, name, avatar, up to 3 covers). |
| T2 | S2, S3, S5 | inline | pending | `html-to-image` 1.11.13, `cardImage` (1080 × 1920 PNG) and `shareOrDownload` (Web Share with files, else download); CSP `connect-src` for the cover and avatar hosts. |
| T3 | S1, S3, S5, S6 | inline | pending | `/tarjeta` route: M05 step and M07 preview, "Tarjeta" in `MainNav`, events through the signed-in context, `docs/criterios/RF-30.feature`. |

Route evidence: one feature in dependent deliveries (card, image and sharing, then the screen); no writer trigger holds.

## Log

- L1 (2026-11-04, stakeholder): "Tarjeta" (start #36 after #35 merged).
- L2 (2026-11-04, stakeholder): "Card first, QR with #37 (Recommended)".
- L3 (2026-11-04, assumptions): The entry is the "Tarjeta" tab of the bar; the M04 invitation over the catalog waits, since nothing defines when it shows. M06 (name and avatar) belongs to #39: the card uses the profile's name and avatar, or the initial. Only the "Clásica" style; Neón and Manga are Plus. The card shows the display name where Figma has "@jorge" (no handle until #37) and "acrux.app" with the Acrux mark where Figma has the profile URL and the QR. M05 lists the franchises in Viendo (as "Mi lista"), up to 3 checked by default, at most 3 on the card; its search filters that list; choosing only changes the card, not the marks; "Saltar" keeps the default choice; with nothing in Viendo the step is skipped and the card has no "VIENDO AHORA". The total follows the counter mode: "ANIMES COMPLETOS" by franchises, "ENTRADAS VISTAS" by entries. Spike check (2026-11-04): `s4.anilist.co` and `lh3.googleusercontent.com` answer with `Access-Control-Allow-Origin`, so the avatar embeds too; `html-to-image` fetches images, so both hosts go to `connect-src`.
