import type { Franchise, Mark } from '@acrux/domain';
import { describe, expect, it } from 'vitest';
import type { CatalogAnime } from '../catalog-source/client';
import { anime } from '../catalog-source/test-support';
import { markedOn, myList } from './items';

const NOW = '2026-11-03T12:00:00.000Z';

const member = (id: number, year: number) => ({ id, joinedAt: `${year}-01-01` });
// Saga A: core 1 → 2 → 3, extra 9. Saga B: the movie 20.
const sagaA: Franchise = {
  rootId: 1,
  title: 'Saga A',
  core: [member(1, 2013), member(2, 2017), member(3, 2019)],
  extras: [9],
  related: [],
};
const sagaB: Franchise = {
  rootId: 20,
  title: 'Saga B',
  core: [member(20, 2016)],
  extras: [],
  related: [],
};

function media(id: number, format: string): CatalogAnime {
  return anime(id, { format, title: `Entry ${id}` });
}
const known = new Map(
  [1, 2, 3, 9, 20].map((id) => [id, media(id, id === 20 ? 'MOVIE' : id === 9 ? 'OVA' : 'TV')]),
);

const mark = (animeId: number, status: Mark['status'], day: number): Mark => ({
  animeId,
  status,
  markedAt: `2026-10-${String(day).padStart(2, '0')}T12:00:00.000Z`,
});

describe('myList', () => {
  it('lists complete franchises as seen, newest mark first, with "N de M · marcada el …"', () => {
    const marks = [
      mark(1, 'seen', 2),
      mark(2, 'seen', 2),
      mark(3, 'seen', 10),
      mark(20, 'seen', 12),
    ];
    const list = myList([sagaA, sagaB], marks, known, 'franchise', NOW);
    expect(list.seen).toEqual([
      {
        id: 'franchise-20',
        href: '/franquicia/20',
        title: 'Saga B',
        coverUrl: 'https://cdn.example.test/anime/20.jpg',
        detail: '1 de 1 · marcada el 12 de oct.',
      },
      {
        id: 'franchise-1',
        href: '/franquicia/1',
        title: 'Saga A',
        coverUrl: 'https://cdn.example.test/anime/1.jpg',
        detail: '3 de 3 · marcada el 10 de oct.',
      },
    ]);
    expect(list.stats).toEqual({ complete: 2, seenEntries: 4, watching: 0 });
  });

  it('leaves a partial franchise out of the seen list, as the counter does (RNF-42)', () => {
    const list = myList([sagaA], [mark(1, 'seen', 2), mark(9, 'seen', 3)], known, 'franchise', NOW);
    expect(list.seen).toEqual([]);
    expect(list.stats.complete).toBe(0);
  });

  it('lists the franchises in state Viendo', () => {
    const marks = [mark(1, 'seen', 2), mark(2, 'watching', 5), mark(20, 'watching', 7)];
    const list = myList([sagaA, sagaB], marks, known, 'franchise', NOW);
    expect(list.watching.map((row) => [row.title, row.detail])).toEqual([
      ['Saga B', '0 de 1 · marcada el 7 de oct.'],
      ['Saga A', '1 de 3 · marcada el 5 de oct.'],
    ]);
    expect(list.stats.watching).toBe(2);
  });

  it('lists every seen entry when counting by entries, extras included', () => {
    const marks = [
      mark(1, 'seen', 2),
      mark(9, 'seen', 3),
      mark(2, 'watching', 4),
      mark(77, 'seen', 1),
    ];
    const list = myList([sagaA], marks, known, 'entry', NOW);
    expect(list.seen.map((row) => [row.href, row.title, row.detail])).toEqual([
      ['/franquicia/9', 'Entry 9', 'OVA · marcada el 3 de oct.'],
      ['/franquicia/1', 'Entry 1', 'TV · marcada el 2 de oct.'],
      // The catalog did not return it, but it still counts.
      ['/franquicia/77', 'Entrada 77', 'marcada el 1 de oct.'],
    ]);
    expect(list.stats.seenEntries).toBe(3);
  });
});

describe('markedOn', () => {
  it('writes the day and the short month in Spanish', () => {
    expect(markedOn('2026-09-28T12:00:00.000Z')).toBe('marcada el 28 de sept.');
    expect(markedOn('2026-05-01T12:00:00.000Z')).toBe('marcada el 1 de may.');
  });
});
