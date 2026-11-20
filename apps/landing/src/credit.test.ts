import { describe, expect, it } from 'vitest';
import { getCopy } from './i18n';
import { CC_BY_SA_URL, getLegalPage, MAL_URL, TVMAZE_URL } from './legal';

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

describe('TVmaze credit (#150, ADR-0046, point 4)', () => {
  it('links to TVmaze and to its license', () => {
    expect(TVMAZE_URL).toBe('https://www.tvmaze.com');
    expect(CC_BY_SA_URL).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
  });

  it.each(LOCALES)('credits TVmaze in the footer (%s), next to MyAnimeList', (locale) => {
    const { attribution } = getCopy(locale).footer;
    expect(attribution).toContain('{mal}');
    expect(attribution).toContain('{tvmaze}');
  });

  it.each(LOCALES)('credits TVmaze and names its license in the terms (%s)', (locale) => {
    const section = getLegalPage(locale, 'terms').sections.find((s) => s.title.includes('TVmaze'));
    const text = section?.paragraphs.join(' ');
    expect(text).toContain('{mal}');
    expect(text).toContain('{tvmaze}');
    expect(text).toContain('{ccbysa}');
  });
});
