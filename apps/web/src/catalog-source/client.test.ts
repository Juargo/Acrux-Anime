import { describe, expect, it, vi } from 'vitest';
import { CatalogError, createCatalogClient } from './client';
import { anime } from './test-support';

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function harness(...responses: Array<() => Response | Promise<Response>>) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  });
  return { client: createCatalogClient({ fetch }), fetch };
}

const requested = (fetch: ReturnType<typeof harness>['fetch'], call = 0) => {
  const [input] = fetch.mock.calls[call] as [string];
  const url = new URL(input, 'https://app.example.test');
  return { path: url.pathname, query: Object.fromEntries(url.searchParams) };
};

describe('catalog client: browse', () => {
  it('asks our own API for a page with every filter, and returns the validated page', async () => {
    const page = { items: [anime(1)], related: [anime(2)], nextPage: 4 };
    const { client, fetch } = harness(() => reply(page));

    const result = await client.browse(
      { search: 'frieren', year: 2023, genres: ['Fantasy', 'Action'], formats: ['TV', 'MOVIE'] },
      3,
    );

    expect(result).toEqual(page);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(requested(fetch)).toEqual({
      path: '/api/v1/catalog/anime',
      query: {
        search: 'frieren',
        year: '2023',
        genres: 'Fantasy,Action',
        formats: 'TV,MOVIE',
        page: '3',
      },
    });
  });

  it('leaves out the filters that are not set', async () => {
    const { client, fetch } = harness(() => reply({ items: [], related: [], nextPage: null }));

    await client.browse({ genres: [], formats: [] }, 1);

    expect(requested(fetch).query).toEqual({ page: '1' });
  });

  it('does not send credentials or custom headers: the catalog is public', async () => {
    const { client, fetch } = harness(() => reply({ items: [], related: [], nextPage: null }));

    await client.browse({ genres: [], formats: [] }, 1);

    const init = fetch.mock.calls[0]?.[1];
    expect(init?.headers ?? {}).not.toHaveProperty('authorization');
    expect(init?.headers ?? {}).not.toHaveProperty('Authorization');
  });

  it('keeps a cover that is not https out of the page instead of failing it', async () => {
    const { client } = harness(() =>
      reply({
        items: [{ ...anime(1), coverUrl: 'http://cdn.example.test/1.jpg' }],
        related: [],
        nextPage: null,
      }),
    );

    const page = await client.browse({ genres: [], formats: [] }, 1);

    expect(page.items[0]?.coverUrl).toBeNull();
  });
});

describe('catalog client: byIds', () => {
  it('asks for the ids in one request and returns the anime found', async () => {
    const { client, fetch } = harness(() => reply({ items: [anime(5), anime(7)] }));

    expect(await client.byIds([5, 7, 9])).toEqual([anime(5), anime(7)]);
    expect(requested(fetch)).toEqual({
      path: '/api/v1/catalog/anime/by-ids',
      query: { ids: '5,7,9' },
    });
  });
});

describe('catalog client: franchises', () => {
  it('asks for the seeds and returns what was reached, what is missing and what is pending', async () => {
    const crawl = { items: [anime(1)], related: [anime(9)], missing: [404], pending: [3] };
    const { client, fetch } = harness(() => reply(crawl));

    expect(await client.franchises([1, 404])).toEqual(crawl);
    expect(requested(fetch)).toEqual({
      path: '/api/v1/catalog/franchises',
      query: { seeds: '1,404' },
    });
  });
});

describe('catalog client: genres', () => {
  it('returns the genre names', async () => {
    const { client, fetch } = harness(() => reply({ items: ['Action', 'Fantasy'] }));

    expect(await client.genres()).toEqual(['Action', 'Fantasy']);
    expect(requested(fetch)).toEqual({ path: '/api/v1/catalog/genres', query: {} });
  });
});

describe('catalog client: errors', () => {
  const failure = (run: ReturnType<typeof harness>['client']) =>
    run.genres().catch((error: unknown) => error);

  it('reports a 429 as rate-limited', async () => {
    const { client } = harness(() => reply({ code: 'rate_limited' }, 429));
    const error = await failure(client);
    expect(error).toBeInstanceOf(CatalogError);
    expect((error as CatalogError).kind).toBe('rate-limited');
  });

  it('reports a 503 from the API as unavailable', async () => {
    const { client } = harness(() => reply({ code: 'catalog.unavailable' }, 503));
    expect(((await failure(client)) as CatalogError).kind).toBe('unavailable');
  });

  it('reports a network failure as unavailable', async () => {
    const { client } = harness(() => {
      throw new TypeError('offline');
    });
    expect(((await failure(client)) as CatalogError).kind).toBe('unavailable');
  });

  it('reports a rejected query (400) as a query error', async () => {
    const { client } = harness(() => reply({ code: 'catalog.invalid_query' }, 400));
    expect(((await failure(client)) as CatalogError).kind).toBe('query');
  });

  it('reports an answer that does not match the contract as an invalid response', async () => {
    const { client } = harness(() => reply({ items: 'Action' }));
    expect(((await failure(client)) as CatalogError).kind).toBe('invalid-response');
  });

  it('reports a body that is not JSON as an invalid response', async () => {
    const { client } = harness(() => new Response('<html>', { status: 200 }));
    expect(((await failure(client)) as CatalogError).kind).toBe('invalid-response');
  });

  it('does not retry by itself: one request per call', async () => {
    const { client, fetch } = harness(() => reply({}, 429));
    await failure(client);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
