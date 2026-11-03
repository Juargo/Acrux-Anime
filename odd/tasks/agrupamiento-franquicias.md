# Feature: franchise grouping from AniList relations (issue #30)

Objective: a pure function in a new `packages/domain` groups AniList entries into franchises (core, extras, related), applies the curator table first, and computes each franchise's state, progress and the two counters.
Branch: `feat/agrupamiento-franquicias` · Delivery: `single-pr` · Test runner: vitest in `packages/domain`, coverage ≥ 90 % enforced by `pnpm test`.

## Specs

- S1 (issue #30): "Núcleo: secuelas y precuelas; extras: historias paralelas y resúmenes; franquicias aparte: spin-offs y remakes, enlazadas como relacionadas". RDI-30: "las entradas de música se ignoran. [...] Es una función pura de `packages/domain`."
- S2 (issue #30): "Aplicar primero las correcciones del curador (`franchise_override`)". RDI-30: "La tabla del curador siempre prevalece." RF-60: "Una corrección nunca resta al total de nadie."
- S3 (issue #30): "Progreso parcial ("3/5 temporadas") y franquicia completa (RF-26)". RF-26: "Estado de cada saga con prioridad **Viendo > Vista > Parcial > Sin marcar**. Parcial muestra el progreso del núcleo ("3/5 temporadas")."
- S4 (issue #30): "Contador por franquicias y por entradas (RDI-32)". RDI-32: "El contador por franquicias cuenta franquicias con todo el núcleo visto; el contador por entradas cuenta cada entrada vista, de cualquier formato." RDI-34: "Si el catálogo cambia (nueva temporada, entrada fusionada o eliminada), el usuario no pierde lo marcado y el total no baja (DD-03)."
- S5 (issue #30): "Casos de prueba con sagas populares reales (respuestas fijas de AniList)".
- S6 (acceptance, @CA-RF15-01): "Dado una saga con dos temporadas, una película secuela y un spin-off / Cuando se calcula su franquicia / Entonces el núcleo contiene las dos temporadas y la película / Y el spin-off es una franquicia aparte marcada como relacionada".
- S7 (issue #30): "Cobertura ≥ 90 % en `packages/domain`". ADR-0019 rule 2: "`packages/domain` no tiene I/O: sin red, base de datos ni framework."

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S7 | inline | done | `packages/domain` with vitest + `@vitest/coverage-v8` 5.0.5, thresholds 90 % in `pnpm test`; dependency-cruiser rule `domain-stays-pure` added to the CI layers step. Risk: item 5 |
| T2 | S1, S2, S6 | inline | done | `groupFranchises`: RED (module missing), GREEN 14 tests incl. `@CA-RF15-01`; `docs/criterios/RF-15.feature` |
| T3 | S3, S4 | inline | done | `franchiseProgress`, `countCompleteFranchises`, `countSeenEntries`: RED (module missing), GREEN 10 tests |
| T4 | S5 | inline | done | fixed AniList answers for Shingeki no Kyojin, Fullmetal Alchemist, Kimetsu no Yaiba; 5 tests. Suite: 29 domain tests, coverage 99.4 % statements / 97.95 % branches; api 85, web 27, landing 26 green; typecheck green |

Route evidence: one package and one behavior chain where each task builds on the previous one, so there are no independent parallel units and no writer reason; all inline.

## Log

- L1 (2026-11-03, stakeholder): "continuemos" (next H2 issue after #29: #30).
- L2 (2026-11-03, assumptions proposed to the stakeholder, not objected): core = transitive closure over SEQUEL/PREQUEL, any format except MUSIC; extras = SIDE_STORY, SUMMARY, COMPILATION one hop from the core, not followed further; related franchises = SPIN_OFF and ALTERNATIVE (AniList has no REMAKE type; remakes come as ALTERNATIVE), linked but not traversed; CHARACTER, OTHER, ADAPTATION, SOURCE, CONTAINS, PARENT and non-anime nodes are ignored; root = core entry with the earliest start date, ties by lowest id, and the franchise takes the root's title; curator overrides apply first, per entry (`role` + `franchiseRootId`); state: any core entry watching → Viendo, whole core seen → Vista, some core seen → Parcial; extras never change the state; traversal terminates on cycles.
- L3 (2026-11-03, stakeholder decision on RDI-32 vs DD-03): "Corte por fecha". A franchise counts as complete when every core entry released before the user's latest mark in it is seen; newer entries show it as having a new season without lowering the counter. Pure function, no persistence. Implementation detail (assumption): an entry joins a franchise at the later of its start date and its curator override's `updatedAt`, so a curator correction made after the cutoff does not lower the counter either (RF-60). Entries without a start date are unreleased and never required.
- L4 (2026-11-03): `@vitest/coverage-v8` 5.0.5 was published 2026-10-15, past the 7-day pnpm quarantine, and matches the repo's vitest 5.0.5.
- L5 (2026-11-03): implementation assumptions. A lone entry reached by a side story, summary or compilation edge is an extra; one with its own sequels is a separate related franchise. Relations to entries missing from the given catalog are ignored. An override counts only when both its entry and its root are in the catalog; a `separate` override pins its entry as the root of its own franchise. Output is sorted by root id. Partial AniList dates map to the first day of the month or year.
- L6 (2026-11-03): real data, fetched once from graphql.anilist.co (`relationType(version: 2)`): AniList lists the SnK OVA Kuinaki Sentaku (20811) as PREQUEL of season 1, and the recap movies 20691 → 20692 → 100465 chain as SEQUEL/PREQUEL, so the automatic result needs four curator corrections to leave the eight seasons; Kimetsu no Yaiba's Mugen Ressha movie (112151) and its TV version (129874) are both core, which counts the arc twice in "3/5" until the curator marks one as extra (#42). Recorded, not in scope: RF-21 rewatch ("Viendo de nuevo") needs a mark status that still counts; today a `watching` mark is not seen (#33).
- L7 (2026-11-03): independent verifier (Risk item 5) at `5975716`: item 5 passes (frozen lockfile, all new versions older than 7 days, depcruise fails on `zod` and `node:fs` imports, coverage below 90 % fails `test`, CI otherwise unchanged); S1–S3 and S5–S7 pass; determinism holds over 400 random graphs × 5 shuffles. Blocker B1 (S4, RDI-34): a `watching` mark on a season released after completion moved the cutoff, so starting the new season lowered the counter. Fixed: only seen marks move the cutoff; pinned by a test (RED, then GREEN). Advisory A1 fixed too: relations are sorted before the union, so their order never decides between two curator roots (RED, then GREEN). Recorded, not fixed: A2, an `extra` override whose root is itself an extra drops the entry (curator data error, #42 should validate it); A3, RF-60 at grouping level: a curator `core` override that merges two complete franchises lowers the franchise count from 2 to 1, which needs persistence and a stakeholder decision; A4, an `extra` override that moves the user's only seen core entry lowers the counter. Suite: 31 domain tests, coverage 99.41 %.
- L8 (2026-11-03, stakeholder): "Omitir esta vez" for the native review of the commits against main (18 files, 2614 lines including 1462 lines of fixtures, high risk from the CI step); declined for this candidate only.
