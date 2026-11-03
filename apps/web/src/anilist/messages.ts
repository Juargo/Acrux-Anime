import { AniListError } from './client';

// RNF-21: a clear message, and the reassurance that marks are safe. Marks live in the
// Acrux API, never in the AniList cache.
export function anilistErrorMessage(error: unknown): string {
  const kind = error instanceof AniListError ? error.kind : 'unavailable';
  switch (kind) {
    case 'rate-limited':
      return 'AniList está recibiendo muchas consultas. Espera un minuto y vuelve a intentarlo; lo que marcaste sigue guardado.';
    case 'invalid-response':
    case 'query':
      return 'No pudimos leer el catálogo de AniList. Vuelve a intentarlo más tarde; lo que marcaste sigue guardado.';
    default:
      return 'No pudimos conectar con AniList. Revisa tu conexión y vuelve a intentarlo; lo que marcaste sigue guardado.';
  }
}
