import { describe, expect, it, vi } from 'vitest';
import { fetchMarks, MarksError, saveMarks } from './marks-api';

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
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/marks', {
      headers: { Authorization: 'Bearer jwt' },
    });
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
