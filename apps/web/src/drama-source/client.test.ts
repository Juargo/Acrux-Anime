import { describe, expect, it, vi } from 'vitest';
import { CatalogError } from '../catalog-source/client';
import { createDramaClient } from './client';

const drama = {
  id: 1,
  title: 'Crash Landing on You',
  aliases: [],
  summary: null,
  coverUrl: 'https://static.tvmaze.test/1.jpg',
  tvmazeUrl: 'https://www.tvmaze.com/shows/1',
  country: 'KR',
  language: 'Korean',
  origin: 'KR',
  year: 2019,
  seasons: 1,
  episodes: 16,
  genres: ['Drama', 'Romance'],
};

function clientFor(answer: () => Response | Promise<Response>) {
  const fetchFn = vi.fn(async (_input: RequestInfo | URL) => answer());
  return { client: createDramaClient({ fetch: fetchFn as unknown as typeof fetch }), fetchFn };
}

const requested = (fetchFn: { mock: { calls: unknown[][] } }, call = 0) =>
  new URL(String(fetchFn.mock.calls[call]?.[0]), 'http://x.test');

describe('createDramaClient', () => {
  it('asks only the drama route, with the search, the origin, the genres and the page', async () => {
    const { client, fetchFn } = clientFor(() => Response.json({ items: [], nextPage: null }));

    await client.browse({ search: 'crash', origin: 'KR', genres: ['Drama', 'Romance'] }, 2);

    const url = requested(fetchFn);
    expect(url.pathname).toBe('/api/v1/dramas');
    expect(url.searchParams.get('search')).toBe('crash');
    expect(url.searchParams.get('origin')).toBe('KR');
    expect(url.searchParams.get('genres')).toBe('Drama,Romance');
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('sends no search, origin or genres when none is chosen', async () => {
    const { client, fetchFn } = clientFor(() => Response.json({ items: [], nextPage: null }));

    await client.browse({ genres: [] }, 1);

    expect(requested(fetchFn).search).toBe('?page=1');
  });

  it('reads the card fields and keeps unknown seasons and episodes as null, not zero', async () => {
    const { client } = clientFor(() =>
      Response.json({
        items: [drama, { ...drama, id: 2, seasons: null, episodes: null, origin: null }],
        nextPage: 3,
      }),
    );

    const page = await client.browse({ genres: [] }, 2);

    expect(page.nextPage).toBe(3);
    expect(page.items[0]).toMatchObject({
      title: 'Crash Landing on You',
      origin: 'KR',
      year: 2019,
    });
    expect(page.items[1]).toMatchObject({ seasons: null, episodes: null, origin: null });
  });

  it('drops a cover that is not https instead of failing the page', async () => {
    const { client } = clientFor(() =>
      Response.json({
        items: [{ ...drama, coverUrl: 'http://static.tvmaze.test/1.jpg' }],
        nextPage: null,
      }),
    );

    expect((await client.browse({ genres: [] }, 1)).items[0]?.coverUrl).toBeNull();
  });

  it('reads the genre list from the drama route', async () => {
    const { client, fetchFn } = clientFor(() => Response.json({ items: ['Drama', 'Romance'] }));

    expect(await client.genres()).toEqual(['Drama', 'Romance']);
    expect(requested(fetchFn).pathname).toBe('/api/v1/dramas/genres');
  });

  it('names the failure the way the anime catalog does', async () => {
    const limited = clientFor(() => new Response(null, { status: 429 }));
    await expect(limited.client.browse({ genres: [] }, 1)).rejects.toMatchObject({
      kind: 'rate-limited',
    });
    const broken = clientFor(() => Response.json({ items: 'nope' }));
    await expect(broken.client.genres()).rejects.toBeInstanceOf(CatalogError);
  });

  it('asks for the dramas of some ids, 100 at most per request, each id once', async () => {
    const { client, fetchFn } = clientFor(() => Response.json({ items: [drama], missing: [] }));
    const ids = [...Array.from({ length: 150 }, (_, index) => index + 1), 1, 2];

    const found = await client.byIds(ids);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(requested(fetchFn).pathname).toBe('/api/v1/dramas/by-ids');
    expect(requested(fetchFn).searchParams.get('ids')?.split(',')).toHaveLength(100);
    expect(requested(fetchFn, 1).searchParams.get('ids')?.split(',')).toHaveLength(50);
    expect(found.map((item) => item.title)).toEqual([drama.title, drama.title]);
  });

  it('asks nothing for no ids', async () => {
    const { client, fetchFn } = clientFor(() => Response.json({ items: [], missing: [] }));

    expect(await client.byIds([])).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
