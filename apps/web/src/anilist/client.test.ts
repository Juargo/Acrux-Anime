import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AniListError, createAniListClient } from './client';

const schema = z.object({ ok: z.boolean() });
const QUERY = 'query { ok }';

function reply(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

function harness(responses: Array<() => Response | Promise<Response>>) {
  let clock = 1_800_000_000_000;
  const waits: number[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  });
  const rateLimited = vi.fn();
  const client = createAniListClient({
    fetch,
    now: () => clock,
    sleep: async (ms) => {
      waits.push(ms);
      clock += ms;
    },
    onRateLimited: rateLimited,
  });
  return { client, fetch, waits, rateLimited };
}

describe('AniList client', () => {
  it('posts the query to AniList and returns the validated data', async () => {
    const { client, fetch } = harness([() => reply({ data: { ok: true } })]);
    await expect(client.request(QUERY, { a: 1 }, schema)).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { a: 1 } }),
    });
  });

  it('waits until X-RateLimit-Reset after a 429 and retries', async () => {
    const { client, waits, rateLimited } = harness([
      () => reply({}, { status: 429, headers: { 'x-ratelimit-reset': '1800000030' } }),
      () => reply({ data: { ok: true } }),
    ]);
    await expect(client.request(QUERY, {}, schema)).resolves.toEqual({ ok: true });
    expect(waits).toEqual([30_000]);
    expect(rateLimited).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially when the reset is missing, then fails with a rate limit error', async () => {
    const limited = () => reply({}, { status: 429 });
    const { client, waits, rateLimited } = harness([limited, limited, limited, limited]);
    const error = await client.request(QUERY, {}, schema).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AniListError);
    expect((error as AniListError).kind).toBe('rate-limited');
    expect(waits).toEqual([1_000, 2_000, 4_000]);
    expect(rateLimited).toHaveBeenCalledTimes(4);
  });

  it('waits for the next minute before spending a request when none remain', async () => {
    const { client, waits } = harness([
      () => reply({ data: { ok: true } }, { headers: { 'x-ratelimit-remaining': '0' } }),
      () => reply({ data: { ok: true } }),
    ]);
    await client.request(QUERY, {}, schema);
    await client.request(QUERY, {}, schema);
    expect(waits).toEqual([60_000]);
  });

  it('rejects a response that does not match the schema', async () => {
    const { client } = harness([() => reply({ data: { ok: 'yes' } })]);
    const error = await client.request(QUERY, {}, schema).catch((caught: unknown) => caught);
    expect((error as AniListError).kind).toBe('invalid-response');
  });

  it('reports GraphQL errors and server failures', async () => {
    const { client } = harness([
      () =>
        reply({ data: null, errors: [{ message: 'Not Found.', status: 404 }] }, { status: 404 }),
      () => reply({ errors: [{ message: 'Internal' }] }, { status: 500 }),
    ]);
    const query = await client.request(QUERY, {}, schema).catch((caught: unknown) => caught);
    const server = await client.request(QUERY, {}, schema).catch((caught: unknown) => caught);
    expect((query as AniListError).kind).toBe('query');
    expect((server as AniListError).kind).toBe('unavailable');
  });

  it('reports a network failure as unavailable', async () => {
    const { client } = harness([
      () => {
        throw new TypeError('Failed to fetch');
      },
    ]);
    const error = await client.request(QUERY, {}, schema).catch((caught: unknown) => caught);
    expect((error as AniListError).kind).toBe('unavailable');
  });

  it('waits for X-RateLimit-Reset even when the 429 also says no requests remain', async () => {
    const { client, waits } = harness([
      () =>
        reply(
          {},
          {
            status: 429,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000030' },
          },
        ),
      () => reply({ data: { ok: true } }),
    ]);
    await client.request(QUERY, {}, schema);
    expect(waits).toEqual([30_000]);
  });

  it('keeps waiting and retrying when the rate limit callback throws', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch
      .mockResolvedValueOnce(reply({}, { status: 429 }))
      .mockResolvedValueOnce(reply({ data: { ok: true } }));
    const client = createAniListClient({
      fetch,
      sleep: async () => {},
      onRateLimited: () => {
        throw new Error('analytics is down');
      },
    });
    await expect(client.request(QUERY, {}, schema)).resolves.toEqual({ ok: true });
  });
});
