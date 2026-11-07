import type { webSpanish } from '@acrux/i18n';

// Typed keys: t('…') only accepts keys that exist in the Spanish source.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof webSpanish };
  }
}
