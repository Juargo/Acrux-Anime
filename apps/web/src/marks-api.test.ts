import { describe, expect, it, vi } from 'vitest';
import { deleteMark, fetchMarks, MarksError, putMark, saveMarks } from './marks-api';

const token = async () => 'jwt';
const mark = {
  anilistId: 16498,
  malId: 16498,
  status: 'seen',
  markedAt: '2026-11-03T12:00:00.000Z',
};

function respond(status: number, body?: unknown) {
  return vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

describe('marks API client', () => {
  it('reads the marks of the signed-in user', async () => {
    const fetchFn = respond(200, { items: [mark], nextCursor: null });

    expect(await fetchMarks(token, fetchFn)).toEqual([mark]);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/marks?limit=1000', {
      headers: { Authorization: 'Bearer jwt' },
    });
  });

  it('reads every page, following nextCursor', async () => {
    const pages: Record<string, unknown> = {
      '/api/v1/me/marks?limit=1000': { items: [mark], nextCursor: '16498' },
      '/api/v1/me/marks?limit=1000&cursor=16498': {
        items: [{ ...mark, anilistId: 20958 }],
        nextCursor: null,
      },
    };
    const fetchFn = vi.fn(async (url: string) => Response.json(pages[url]));
    const marks = await fetchMarks(token, fetchFn as unknown as typeof fetch);
    expect(marks.map((item) => item.anilistId)).toEqual([16498, 20958]);
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual(Object.keys(pages));
  });

  it('fails instead of paging forever when the cursor goes back', async () => {
    const pages: Record<string, unknown> = {
      '/api/v1/me/marks?limit=1000': { items: [mark], nextCursor: '20' },
      '/api/v1/me/marks?limit=1000&cursor=20': { items: [mark], nextCursor: '10' },
    };
    const fetchFn = vi.fn(async (url: string) => Response.json(pages[url]));
    await expect(fetchMarks(token, fetchFn as unknown as typeof fetch)).rejects.toMatchObject({
      kind: 'failed',
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('marks a whole core in one batch request', async () => {
    const fetchFn = respond(200, { items: [mark] });

    const saved = await saveMarks(
      token,
      { status: 'seen', entries: [{ anilistId: 16498, malId: 16498 }] },
      fetchFn,
    );

    expect(saved).toEqual([mark]);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/marks:batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'seen', entries: [{ anilistId: 16498, malId: 16498 }] }),
    });
  });

  it('marks one entry with its status and MAL id', async () => {
    const fetchFn = respond(200, mark);

    expect(await putMark(token, 16498, { status: 'seen', malId: 16498 }, fetchFn)).toEqual(mark);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/marks/16498', {
      method: 'PUT',
      headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'seen', malId: 16498 }),
    });
  });

  it('unmarks one entry, answered with no content', async () => {
    const fetchFn = respond(204);

    await expect(deleteMark(token, 16498, fetchFn)).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/marks/16498', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer jwt' },
    });
  });

  it('fails the same way on one entry as on a batch', async () => {
    await expect(
      putMark(token, 1, { status: 'watching' }, respond(503, { requestId: 'req-2' })),
    ).rejects.toMatchObject({ kind: 'failed', requestId: 'req-2' });
    await expect(deleteMark(token, 1, respond(401, {}))).rejects.toMatchObject({
      kind: 'signed-out',
    });
  });

  it('fails with the request id when the API answers with an error', async () => {
    const fetchFn = respond(503, { code: 'profile.unavailable', requestId: 'req-1' });

    const error = await saveMarks(
      token,
      { status: null, entries: [{ anilistId: 1 }] },
      fetchFn,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MarksError);
    expect(error).toMatchObject({ kind: 'failed', requestId: 'req-1' });
  });

  it('fails as signed out without a token or on a 401', async () => {
    await expect(fetchMarks(async () => null, respond(200, {}))).rejects.toMatchObject({
      kind: 'signed-out',
    });
    await expect(fetchMarks(token, respond(401, {}))).rejects.toMatchObject({ kind: 'signed-out' });
  });

  it('fails as unavailable when the API cannot be reached', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(fetchMarks(token, fetchFn)).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
