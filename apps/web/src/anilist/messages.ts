import type { TFunction } from 'i18next';
import { i18n } from '../i18n';
import { AniListError } from './client';

// RNF-21: a clear message, and the reassurance that marks are safe. Marks live in the
// Acrux API, never in the AniList cache.
export function anilistErrorMessage(error: unknown, t: TFunction = i18n.t): string {
  const kind = error instanceof AniListError ? error.kind : 'unavailable';
  switch (kind) {
    case 'rate-limited':
      return t('anilist.rateLimited');
    case 'invalid-response':
    case 'query':
      return t('anilist.unreadable');
    default:
      return t('anilist.unavailable');
  }
}
