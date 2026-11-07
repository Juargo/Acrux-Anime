// Supported locales (ADR-0010). Spanish is the default of the landing.
export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'es';

// When the device language is none of the supported ones, the web app uses English (ADR-0010).
export const fallbackLocale: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export { es as webSpanish } from './web/es';
export type { WebMessages } from './web/messages';
export { webMessages } from './web/messages';
