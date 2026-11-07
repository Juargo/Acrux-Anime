import { fallbackLocale, isLocale, type Locale, locales, webMessages } from '@acrux/i18n';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// The last language used on this browser, so signed-out screens and the first paint match it.
// The account keeps the real choice (#43); this is only a cache.
const STORAGE_KEY = 'acrux.locale';

function store(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function storedLocale(): Locale | undefined {
  try {
    const value = store()?.getItem(STORAGE_KEY);
    return value && isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

// The first browser language we support, ignoring the region (es-CL is es); English otherwise (ADR-0010).
export function browserLocale(): Locale {
  for (const language of navigator.languages ?? [navigator.language]) {
    const base = language.split('-')[0]?.toLowerCase() ?? '';
    if (isLocale(base)) return base;
  }
  return fallbackLocale;
}

function applyLocale(locale: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  try {
    store()?.setItem(STORAGE_KEY, locale);
  } catch {
    // Private mode or blocked storage: the account still keeps the choice.
  }
}

export async function initI18n(locale?: Locale): Promise<void> {
  const lng = locale ?? storedLocale() ?? browserLocale();
  if (!i18n.isInitialized) {
    i18n.on('languageChanged', applyLocale);
    await i18n.use(initReactI18next).init({
      lng,
      fallbackLng: fallbackLocale,
      supportedLngs: locales,
      resources: Object.fromEntries(
        Object.entries(webMessages).map(([key, translation]) => [key, { translation }]),
      ),
      interpolation: { escapeValue: false }, // React already escapes.
      returnNull: false,
    });
    applyLocale(lng);
    return;
  }
  await i18n.changeLanguage(lng);
}

export function setLocale(locale: Locale): Promise<unknown> {
  return i18n.changeLanguage(locale);
}

export { i18n };
