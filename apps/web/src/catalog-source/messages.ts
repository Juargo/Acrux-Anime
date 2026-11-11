import type { TFunction } from 'i18next';
import { i18n } from '../i18n';
import { CatalogError } from './client';

// RNF-21: a clear message, and the reassurance that marks are safe. Marks live in the
// Acrux API, never in the catalog cache.
export function catalogErrorMessage(error: unknown, t: TFunction = i18n.t): string {
  const kind = error instanceof CatalogError ? error.kind : 'unavailable';
  switch (kind) {
    case 'rate-limited':
      return t('catalogError.rateLimited');
    case 'invalid-response':
    case 'query':
      return t('catalogError.unreadable');
    default:
      return t('catalogError.unavailable');
  }
}
