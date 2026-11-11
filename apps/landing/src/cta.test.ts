import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_URL, getCopy } from './i18n';
import { getLegalPage } from './legal';

const LOCALES = ['es', 'en'] as const;

// Direct public launch (ADR-0044): the landing sends people to the app, not to a waitlist.
describe('landing call to action (ADR-0044)', () => {
  it('points to the app', () => {
    expect(APP_URL).toBe('https://app.acruxanime.com');
  });

  it.each(LOCALES)('offers to open the app and no longer mentions a beta (%s)', (locale) => {
    const copy = getCopy(locale);
    expect(copy.cta.label).toBe(locale === 'es' ? 'Abrir Acrux' : 'Open Acrux');
    expect(JSON.stringify([copy.hero, copy.cta, copy.finalCta])).not.toMatch(/beta/i);
  });

  it('links both calls to action to the app instead of the waitlist form', () => {
    const page = readFileSync(new URL('./components/LandingPage.astro', import.meta.url), 'utf8');
    expect(page.match(/href=\{APP_URL\}/g)).toHaveLength(2);
    expect(page).not.toContain('WaitlistForm');
  });

  it.each(LOCALES)('has terms that no longer describe the app as a beta (%s)', (locale) => {
    const terms = getLegalPage(locale, 'terms');
    expect(JSON.stringify(terms)).not.toMatch(/beta/i);
    // The warning that the app may change or fail stays.
    expect(JSON.stringify(terms)).toMatch(
      locale === 'es' ? /puede cambiar o fallar/ : /may change or fail/,
    );
  });

  it.each(LOCALES)('has legal pages that no longer describe a waitlist (%s)', (locale) => {
    for (const key of ['privacy', 'support', 'terms'] as const) {
      expect(JSON.stringify(getLegalPage(locale, key))).not.toMatch(
        /beta|waitlist|lista de espera|buttondown/i,
      );
    }
  });

  it('no longer serves the waitlist endpoint', () => {
    expect(existsSync(new URL('./pages/api/waitlist.ts', import.meta.url))).toBe(false);
  });
});
