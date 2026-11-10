# ZAP baseline

El workflow semanal (`.github/workflows/weekly.yml`) corre ZAP baseline contra `https://app.acruxanime.com` y abre o actualiza el issue «ZAP baseline: hallazgos en app.acruxanime.com». Las reglas aceptadas están en `.zap/rules.tsv`.

## Hallazgos resueltos (#73)

| Regla | Hallazgo | Cambio en `apps/web/vercel.json` |
|---|---|---|
| 10098 | Cross-Domain Misconfiguration: Vercel respondía `Access-Control-Allow-Origin: *` en los archivos estáticos | `Access-Control-Allow-Origin: https://app.acruxanime.com` en todas las respuestas |
| — | Los recursos con hash de `/assets/` se revalidaban en cada visita (`max-age=0`) | `/assets/*` con `Cache-Control: public, max-age=31536000, immutable` |
| — | Un recurso de `/assets/` que ya no existe devolvía `index.html` con 200 | La reescritura a la SPA excluye `/assets/`; ahora responde 404 |

## Hallazgos aceptados (IGNORE en `.zap/rules.tsv`)

- **10109 Modern Web Application:** es informativo; sólo avisa que la app es una SPA.
- **10049 Storable but Non-Cacheable Content** y **10050 Retrieved from Cache:** son informativos y describen el caché de la CDN de Vercel.
- **10015 Re-examine Cache-control Directives:** el HTML de la app usa `max-age=0, must-revalidate` a propósito, para que cada visita reciba la versión desplegada.
- **90004 Cross-Origin-Embedder-Policy:** la app no necesita aislamiento entre orígenes (no usa `SharedArrayBuffer`). `require-corp` bloquearía las portadas del catálogo (de MyAnimeList, ADR-0043; antes de AniList) y los avatares de Google, que no envían `Cross-Origin-Resource-Policy`, y Safari no admite `credentialless`.

## Un hallazgo nuevo

1. Si es real, corrígelo con su prueba en `apps/web/src/vercel-config.test.ts` y anótalo arriba.
2. Si se acepta, agrega la regla a `.zap/rules.tsv` con `IGNORE` y explica el motivo en esta página.
