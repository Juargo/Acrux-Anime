import { describe, expect, it } from 'vitest';
import { drama } from '../drama-source/test-support';
import type { ListRow, MyList } from '../my-list/items';
import {
  animeChoices,
  type CardChoice,
  defaultChoice,
  dramaChoices,
  MAX_ANIME,
  MAX_DRAMAS,
  shareCardContent,
} from './content';

const row = (
  id: number,
  coverUrl: string | null = `https://cdn.example.test/anime/${id}.png`,
): ListRow => ({
  id: String(id),
  href: `/franquicia/${id}`,
  title: `Saga ${id}`,
  coverUrl,
  detail: '',
});

const list = (watching: ListRow[], seen: ListRow[] = []): MyList => ({
  stats: { complete: 48, seenEntries: 130, watching: watching.length },
  watching,
  seen,
});

const choice = (id: string, watching = false): CardChoice => ({
  id,
  title: `Title ${id}`,
  coverUrl: `https://cdn.example.test/${id}.png`,
  detail: '',
  watching,
});

const profile = { displayName: 'Jorge', avatarUrl: 'https://lh3.googleusercontent.com/a/x' };

const content = (overrides: Partial<Parameters<typeof shareCardContent>[0]> = {}) =>
  shareCardContent({
    list: list([]),
    mode: 'franchise',
    profile,
    anime: [],
    dramas: [],
    dramasSeen: null,
    chosenAnime: [],
    chosenDramas: [],
    ...overrides,
  });

describe('shareCardContent', () => {
  it('shows the complete franchises when counting by franchises', () => {
    expect(content().totals).toEqual([{ value: 48, label: 'ANIMES COMPLETOS' }]);
  });

  it('shows the seen entries when counting by entries', () => {
    expect(content({ mode: 'entry' }).totals).toEqual([{ value: 130, label: 'ENTRADAS VISTAS' }]);
  });

  it('adds the seen dramas next to the anime total once a drama is marked', () => {
    expect(content({ dramasSeen: 7 }).totals).toEqual([
      { value: 48, label: 'ANIMES COMPLETOS' },
      { value: 7, label: 'DRAMAS VISTOS' },
    ]);
    expect(content({ dramasSeen: 0 }).totals).toHaveLength(2);
  });

  it('carries the name, the initial and the avatar of the profile', () => {
    expect(content()).toMatchObject({
      name: 'Jorge',
      initial: 'J',
      avatarUrl: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('@CA-RF55-02 carries the badges only while the owner is Plus', () => {
    const badges = ['titles-10', 'hours-50'];
    expect(content({ profile: { ...profile, plan: 'plus', badges } }).badges).toEqual(badges);
    expect(content({ profile: { ...profile, plan: 'free', badges } }).badges).toEqual([]);
  });

  it('falls back to "Sin nombre" and "?" without a name', () => {
    expect(content({ profile: { displayName: '  ', avatarUrl: null } })).toMatchObject({
      name: 'Sin nombre',
      initial: '?',
    });
  });

  it('@CA-RF30-03 shows the chosen anime and dramas, each under its own heading', () => {
    const anime = [choice('a1'), choice('a2'), choice('a3')];
    const dramas = [choice('d1'), choice('d2')];
    const { picks } = content({
      anime,
      dramas,
      chosenAnime: ['a3', 'a1'],
      chosenDramas: ['d2'],
    });
    expect(picks.map((group) => [group.label, group.covers.map((cover) => cover.id)])).toEqual([
      ['ANIME', ['a1', 'a3']],
      ['DRAMAS', ['d2']],
    ]);
  });

  it('@CA-RF30-04 never shows more than two anime and two dramas', () => {
    const anime = ['a1', 'a2', 'a3'].map((id) => choice(id));
    const dramas = ['d1', 'd2', 'd3'].map((id) => choice(id));
    const { picks } = content({
      anime,
      dramas,
      chosenAnime: ['a1', 'a2', 'a3'],
      chosenDramas: ['d1', 'd2', 'd3'],
    });
    expect(picks.map((group) => group.covers.length)).toEqual([MAX_ANIME, MAX_DRAMAS]);
  });

  it('leaves out a heading with nothing chosen under it', () => {
    expect(content({ anime: [choice('a1')], dramas: [choice('d1')] }).picks).toEqual([]);
    expect(
      content({ anime: [choice('a1')], dramas: [choice('d1')], chosenDramas: ['d1'] }).picks.map(
        (group) => group.label,
      ),
    ).toEqual(['DRAMAS']);
  });

  it('ignores a chosen id that is no longer in the list', () => {
    expect(content({ anime: [choice('a1')], chosenAnime: ['gone'] }).picks).toEqual([]);
  });
});

describe('animeChoices', () => {
  it('offers what is in Viendo first, then what is seen, each once', () => {
    const choices = animeChoices(list([row(1), row(2)], [row(3), row(1)]));
    expect(choices.map(({ id, watching }) => [id, watching])).toEqual([
      ['1', true],
      ['2', true],
      ['3', false],
    ]);
  });
});

describe('dramaChoices', () => {
  it('offers the marked dramas with their origin and year', () => {
    const choices = dramaChoices([
      {
        drama: drama(5, { title: 'Signal', origin: 'KR', year: 2016 }),
        mark: { dramaId: 5, status: 'watching', markedAt: '2026-10-10T12:00:00.000Z' },
      },
      {
        drama: drama(6, { title: 'Nirvana in Fire', origin: 'CN', year: 2015, coverUrl: null }),
        mark: { dramaId: 6, status: 'seen', markedAt: '2026-10-09T12:00:00.000Z' },
      },
    ]);
    expect(choices).toEqual([
      {
        id: 'drama-5',
        title: 'Signal',
        coverUrl: 'https://static.tvmaze.test/5.jpg',
        detail: 'Corea · 2016',
        watching: true,
      },
      {
        id: 'drama-6',
        title: 'Nirvana in Fire',
        coverUrl: null,
        detail: 'China · 2015',
        watching: false,
      },
    ]);
  });
});

describe('defaultChoice', () => {
  it('checks what I am watching, up to the limit', () => {
    const choices = [choice('1', true), choice('2', true), choice('3', true), choice('4')];
    expect(defaultChoice(choices, MAX_ANIME)).toEqual(['1', '2']);
  });

  it('checks nothing when I am watching nothing', () => {
    expect(defaultChoice([choice('1'), choice('2')], MAX_ANIME)).toEqual([]);
  });
});
