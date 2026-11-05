# Feature: edit the display name and avatar, and the Perfil tab (issue #39)

Objective: the user changes the name and avatar the card and the public profile show (Figma M06 29:381), choosing Google's avatar or a preset Acrux one; the Perfil tab (M16 40:2338) holds the header, "Editar", "Contar por", "Tu lista" and "Cerrar sesión"; M06 also sits in the card flow before the first card.
Branch: `feat/editar-perfil` · Delivery: `single-pr` (as #35 to #37) · Test runner: vitest (`apps/api` with supertest and Testcontainers, `apps/web` with Testing Library on jsdom).

## Specs

- S1 (issue #39): "`PATCH /api/v1/me` con validación de nombre (largo, caracteres)". RF-07: "El usuario puede editar su nombre visible y su avatar. Se toman de Google y solo se piden si faltan." Figma M06: "Nombre visible", "Así te verán en tu tarjeta y tu perfil", "5/30".
- S2 (issue #39): "Avatar: elegir entre el de Google o uno predefinido (sin subida de archivos en la beta)". Figma M06: "O elige uno de Acrux" with six presets; "Subir foto" stays out (no uploads in the beta).
- S3 (acceptance, @CA-RF07-01): "Dado que inicié sesión / Cuando cambio mi nombre visible a "Cami" / Entonces mi tarjeta y mi perfil público muestran "Cami"".
- S4 (stakeholder decision L2): "Perfil tab + M06 (Recommended)": the Perfil tab (M16) with only what works today (header with avatar, name, @handle and "Editar", "Contar por", "Tu lista" → `/privacidad`, "Cerrar sesión"); the other rows arrive with their issues. M06 also appears in the card flow, only before the first card (RN-M1). Figma M06 (29:381): "‹ Volver", "Así aparecerás en tu tarjeta", "Solo falta tu foto. Puedes cambiarla después en Ajustes.", "Continuar".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1, S2, S3 | inline | done | `50e8bcd`: migration `20261105000000_avatar_predefinido` (enum `avatar_preset`, nullable); `PATCH /me` accepts `displayName` (trimmed, 1–30 characters counted per code point, no control characters) and `avatarPreset` (null = Google); `/me`, the public summary and the preview image carry it (`domain/avatar.ts`). RED 8 + 3, GREEN; API 209, depcruise, `openapi:check`. Risk: items 1 (migration) and 3 (`/me` grows; `displayName` stops being an unknown PATCH field) |
| T2 | S2, S3 | inline | done | `9eafac8`: `Avatar` (preset, Google, initial) in the header, the card, the public page; `ProfileEditor` (M06) at `/perfil/editar`; Home keeps the live profile (`useOwnProfile`). RED 7 (incl. `@CA-RF07-01`), GREEN; web 203. Risk: none |
| T3 | S4 | inline | done | `/perfil` (M16: header, "Editar", "Contar por", "Tu lista", "Cerrar sesión"), "Perfil" tab, privacy goes back to Perfil, M06 in the card flow before the first card; `docs/criterios/RF-07.feature`. RED 6 + 2, GREEN; web 212. Risk: none |

Route evidence: one feature in dependent deliveries (API, then the editor, then the tab and the card flow); no writer trigger holds.

## Log

- L1 (2026-11-04, stakeholder): "vamos" (start #39 after #37 merged).
- L2 (2026-11-04, stakeholder): "Perfil tab + M06 (Recommended)".
- L3 (2026-11-04, assumptions): The name is trimmed, 1 to 30 characters (M06 "5/30"), without control characters or line breaks; the handle does not change with it (S9 of `odd/tasks/perfil-publico.md`). Presets `violeta`, `verde`, `amarillo`, `coral`, `noche`, `lavanda` use the app's color tokens with the Acrux sparkle; a preset wins over Google's avatar, and choosing Google's sets it back to null. "Contar por" in Perfil switches the mode like the header counter. The header keeps its "Cerrar sesión" button.
- L4 (2026-11-04): T1–T3 done. The preview of this PR needs `db:deploy` on Neon `dev` (`ep-calm-night-b59xx395`) for `20261105000000_avatar_predefinido`, as L10 of `odd/tasks/perfil-publico.md` explains.
- L5 (2026-11-04): independent verifier at `b32880a`: S1–S4 pass; the migration applies on the baseline schema with rows, and the baseline API suite passes on the migrated schema. Two blockers, fixed (RED, then GREEN): the editor accepted names the API rejects (a pasted tab got a 400 forever, blocking the first card), now one rule in `@acrux/domain` (`displayNameProblem`: empty, over 30 code points, control or format characters except ZWJ, line or paragraph separators, nothing visible) used by the editor with its own hint, and a copy in the API (`domain/display-name.ts`, as the compiled API cannot load the domain's TypeScript) kept equal by a contract test; the privacy screen opened from the card goes back to the card (`state.from`), from Perfil to Perfil. Recorded, not fixed: a failing `PATCH /me` blocks the first card at M06; slicing at 30 code points can split a ZWJ emoji; Perfil is not highlighted on `/perfil/editar` and `/privacidad`; the `['me','profile']` cache is not cleared on sign-out (sign-in reloads the page); the preview image keeps an old name or avatar for up to 5 minutes.
