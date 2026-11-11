import { describe, expect, it } from 'vitest';
import { getCopy } from './i18n';
import { getLegalPage, MAL_URL } from './legal';

const LOCALES = ['es', 'en'] as const;

describe('MyAnimeList credit (ADR-0043, point 7)', () => {
  it('links to MyAnimeList', () => {
    expect(MAL_URL).toBe('https://myanimelist.net');
  });

  it.each(LOCALES)('credits MyAnimeList in the footer (%s) and never AniList', (locale) => {
    const { attribution } = getCopy(locale).footer;
    expect(attribution).toContain('{mal}');
    expect(attribution).not.toMatch(/anilist/i);
  });

  it.each(LOCALES)('credits MyAnimeList in the legal catalog section (%s)', (locale) => {
    const section = (['privacy', 'support', 'terms'] as const)
      .flatMap((key) => getLegalPage(locale, key).sections)
      .find((s) => s.title.includes('MyAnimeList'));
    expect(section?.paragraphs.join(' ')).toContain('{mal}');
    for (const key of ['privacy', 'support', 'terms'] as const) {
      expect(JSON.stringify(getLegalPage(locale, key))).not.toMatch(/anilist/i);
    }
  });
});
