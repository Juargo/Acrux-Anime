import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_URL, getCopy } from './i18n';

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
});
