import type { Locale } from '../index';
import { en } from './en';
import { es } from './es';

type Widen<T> = { readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

// The shape every language follows, taken from the Spanish source.
export type WebMessages = Widen<typeof es>;

// Adding a language is one more entry here and in `locales` (RNF-71).
export const webMessages: Record<Locale, WebMessages> = { es, en };
