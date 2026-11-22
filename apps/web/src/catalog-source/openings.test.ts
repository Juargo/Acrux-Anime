import { describe, expect, it } from 'vitest';
import type { Opening } from './client';
import { fetchOpenings, youtubeSearchUrl } from './openings';
import { fakeCatalogClient } from './test-support';

const opening = (title: string): Opening => ({ title, artist: null, episodes: null });

describe('fetchOpenings', () => {
  it('asks again for the ids the server left pending, until none is left', async () => {
    const client = fakeCatalogClient({
      openings: async (ids) => ({
        items: ids
          .slice(0, 2)
          .map((animeId) => ({ animeId, openings: [opening(`OP ${animeId}`)] })),
        pending: ids.slice(2),
      }),
    });
    const found = await fetchOpenings(client, [1, 2, 3, 4, 5, 1]);
    expect([...found.keys()]).toEqual([1, 2, 3, 4, 5]);
    expect(found.get(5)).toEqual([opening('OP 5')]);
    expect(client.openings.mock.calls.map(([ids]) => ids)).toEqual([
      [1, 2, 3, 4, 5],
      [3, 4, 5],
      [5],
    ]);
  });

  it('asks for at most 100 ids per request', async () => {
    const client = fakeCatalogClient({ openings: async () => ({ items: [], pending: [] }) });
    await fetchOpenings(
      client,
      Array.from({ length: 150 }, (_, index) => index + 1),
    );
    expect(client.openings.mock.calls.map(([ids]) => ids.length)).toEqual([100, 50]);
  });

  it('gives up on ids the server keeps leaving pending, with what it has', async () => {
    const client = fakeCatalogClient({
      openings: async (ids) => ({
        items: ids.includes(1) ? [{ animeId: 1, openings: [] }] : [],
        pending: ids.filter((id) => id !== 1),
      }),
    });
    const found = await fetchOpenings(client, [1, 2]);
    expect([...found.keys()]).toEqual([1]);
    expect(client.openings.mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('asks nothing for no ids', async () => {
    const client = fakeCatalogClient();
    expect((await fetchOpenings(client, [])).size).toBe(0);
  });
});

describe('youtubeSearchUrl', () => {
  it('searches YouTube for the opening of the anime, by title and artist', () => {
    const url = new URL(
      youtubeSearchUrl('Fullmetal Alchemist: Brotherhood', {
        title: 'Hologram (ホログラム)',
        artist: 'NICO Touches the Walls',
        episodes: '15-26',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://www.youtube.com/results');
    expect(url.searchParams.get('search_query')).toBe(
      'Fullmetal Alchemist: Brotherhood opening Hologram (ホログラム) NICO Touches the Walls',
    );
  });

  it('leaves an unknown artist out of the search', () => {
    const url = new URL(youtubeSearchUrl('One Piece', opening('We Are!')));
    expect(url.searchParams.get('search_query')).toBe('One Piece opening We Are!');
  });
});
