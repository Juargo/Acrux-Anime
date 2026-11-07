// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserLocale, i18n, initI18n, setLocale } from './i18n';

function stubLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await setLocale('es');
  localStorage.clear();
});

describe('browserLocale', () => {
  it('uses the first supported browser language, ignoring the region', () => {
    stubLanguages(['es-CL', 'en-US']);
    expect(browserLocale()).toBe('es');
  });

  it('skips unsupported languages', () => {
    stubLanguages(['fr-FR', 'en-GB']);
    expect(browserLocale()).toBe('en');
  });

  it('falls back to English when no language is supported (ADR-0010)', () => {
    stubLanguages(['fr-FR', 'de']);
    expect(browserLocale()).toBe('en');
  });
});

describe('initI18n', () => {
  it('starts in the browser language when nothing was chosen', async () => {
    stubLanguages(['en-US']);
    await initI18n();
    expect(i18n.language).toBe('en');
    expect(i18n.t('language.label')).toBe('Language');
  });

  it('starts in the last language used on this browser', async () => {
    stubLanguages(['en-US']);
    localStorage.setItem('acrux.locale', 'es');
    await initI18n();
    expect(i18n.language).toBe('es');
    expect(i18n.t('language.label')).toBe('Idioma');
  });
});

describe('setLocale', () => {
  it('switches the texts, the html lang and remembers it on this browser', async () => {
    await setLocale('en');
    expect(i18n.t('language.label')).toBe('Language');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('acrux.locale')).toBe('en');
  });
});
