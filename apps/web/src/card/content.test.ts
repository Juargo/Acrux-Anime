import { describe, expect, it } from 'vitest';
import type { ListRow, MyList } from '../my-list/items';
import { defaultChoice, MAX_COVERS, shareCardContent } from './content';

const row = (id: number, coverUrl: string | null = `https://s4.anilist.co/${id}.png`): ListRow => ({
  id: String(id),
  href: `/franquicia/${id}`,
  title: `Saga ${id}`,
  coverUrl,
  detail: '',
});

const list = (watching: ListRow[]): MyList => ({
  stats: { complete: 48, seenEntries: 130, watching: watching.length },
  watching,
  seen: [],
});

const profile = { displayName: 'Jorge', avatarUrl: 'https://lh3.googleusercontent.com/a/x' };

describe('shareCardContent', () => {
  it('shows the complete franchises when counting by franchises', () => {
    const card = shareCardContent({ list: list([]), mode: 'franchise', profile, chosen: null });
    expect(card).toMatchObject({ total: 48, label: 'ANIMES COMPLETOS' });
  });

  it('shows the seen entries when counting by entries', () => {
    const card = shareCardContent({ list: list([]), mode: 'entry', profile, chosen: null });
    expect(card).toMatchObject({ total: 130, label: 'ENTRADAS VISTAS' });
  });

  it('carries the name, the initial and the avatar of the profile', () => {
    const card = shareCardContent({ list: list([]), mode: 'franchise', profile, chosen: null });
    expect(card).toMatchObject({
      name: 'Jorge',
      initial: 'J',
      avatarUrl: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('falls back to "Sin nombre" and "?" without a name', () => {
    const card = shareCardContent({
      list: list([]),
      mode: 'franchise',
      profile: { displayName: '  ', avatarUrl: null },
      chosen: null,
    });
    expect(card).toMatchObject({ name: 'Sin nombre', initial: '?', avatarUrl: null });
  });

  it('shows the first three franchises in Viendo when nothing was chosen', () => {
    const watching = [row(1), row(2), row(3), row(4)];
    const card = shareCardContent({
      list: list(watching),
      mode: 'franchise',
      profile,
      chosen: null,
    });
    expect(card.covers.map((cover) => cover.id)).toEqual(['1', '2', '3']);
    expect(card.covers[0]).toEqual({
      id: '1',
      title: 'Saga 1',
      coverUrl: 'https://s4.anilist.co/1.png',
    });
  });

  it('shows only the chosen franchises, in the order of the list and at most three', () => {
    const watching = [row(1), row(2), row(3), row(4), row(5)];
    const card = shareCardContent({
      list: list(watching),
      mode: 'franchise',
      profile,
      chosen: ['5', '2', '4', '1'],
    });
    expect(card.covers.map((cover) => cover.id)).toEqual(['1', '2', '4']);
  });

  it('shows no covers when the choice is empty or nothing is in Viendo', () => {
    expect(
      shareCardContent({ list: list([row(1)]), mode: 'franchise', profile, chosen: [] }).covers,
    ).toEqual([]);
    expect(
      shareCardContent({ list: list([]), mode: 'franchise', profile, chosen: null }).covers,
    ).toEqual([]);
  });
});

describe('defaultChoice', () => {
  it('checks the first three franchises in Viendo', () => {
    expect(MAX_COVERS).toBe(3);
    expect(defaultChoice([row(1), row(2), row(3), row(4)])).toEqual(['1', '2', '3']);
    expect(defaultChoice([row(7)])).toEqual(['7']);
  });
});
