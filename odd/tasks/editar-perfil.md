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
| T1 | S1, S2, S3 | inline | pending | Migration `avatar_preset` (nullable, CHECK on the six keys; null means Google's); `PATCH /me` accepts `displayName` and `avatarPreset`; `/me`, the public summary and the preview image carry the preset. |
| T2 | S2, S3 | inline | pending | `Avatar` (preset, Google or initial) wherever an avatar shows; M06 `ProfileEditor` at `/perfil/editar`. |
| T3 | S4 | inline | pending | `/perfil` (M16) and the "Perfil" tab; M06 in the card flow before the first card; the privacy screen goes back to Perfil. |

Route evidence: one feature in dependent deliveries (API, then the editor, then the tab and the card flow); no writer trigger holds.

## Log

- L1 (2026-11-04, stakeholder): "vamos" (start #39 after #37 merged).
- L2 (2026-11-04, stakeholder): "Perfil tab + M06 (Recommended)".
- L3 (2026-11-04, assumptions): The name is trimmed, 1 to 30 characters (M06 "5/30"), without control characters or line breaks; the handle does not change with it (S9 of `odd/tasks/perfil-publico.md`). Presets `violeta`, `verde`, `amarillo`, `coral`, `noche`, `lavanda` use the app's color tokens with the Acrux sparkle; a preset wins over Google's avatar, and choosing Google's sets it back to null. "Contar por" in Perfil switches the mode like the header counter. The header keeps its "Cerrar sesión" button.
