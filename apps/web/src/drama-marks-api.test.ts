import { describe, expect, it, vi } from 'vitest';
import { deleteDramaMark, fetchDramaMarks, putDramaMark } from './drama-marks-api';
import { MarksError } from './marks-api';

const token = async () => 'jwt';
const mark = { dramaId: 201, status: 'seen', markedAt: '2026-11-20T12:00:00.000Z' };

function respond(status: number, body?: unknown) {
  return vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

describe('drama marks API client (#154)', () => {
  it('reads every page of the drama marks, following nextCursor', async () => {
    const pages: Record<string, unknown> = {
      '/api/v1/me/drama-marks?limit=1000': { items: [mark], nextCursor: '201' },
      '/api/v1/me/drama-marks?limit=1000&cursor=201': {
        items: [{ ...mark, dramaId: 305 }],
        nextCursor: null,
      },
    };
    const fetchFn = vi.fn(async (url: string) => Response.json(pages[url]));
    const marks = await fetchDramaMarks(token, fetchFn as unknown as typeof fetch);
    expect(marks.map((item) => item.dramaId)).toEqual([201, 305]);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/drama-marks?limit=1000', {
      headers: { Authorization: 'Bearer jwt' },
    });
  });

  it('stops when the cursor does not move forward', async () => {
    const fetchFn = respond(200, { items: [mark], nextCursor: '201' });
    await expect(fetchDramaMarks(token, fetchFn)).rejects.toMatchObject({ kind: 'failed' });
  });

  it('marks a drama with its status', async () => {
    const fetchFn = respond(200, mark);
    expect(await putDramaMark(token, 201, { status: 'seen' }, fetchFn)).toEqual(mark);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/drama-marks/201', {
      method: 'PUT',
      headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'seen' }),
    });
  });

  it('unmarks a drama', async () => {
    const fetchFn = respond(204);
    await deleteDramaMark(token, 201, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/me/drama-marks/201', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer jwt' },
    });
  });

  it('fails as signed out without a token or on a 401, and as failed on another error', async () => {
    await expect(fetchDramaMarks(async () => null, respond(200))).rejects.toBeInstanceOf(
      MarksError,
    );
    await expect(putDramaMark(token, 201, { status: 'seen' }, respond(401))).rejects.toMatchObject({
      kind: 'signed-out',
    });
    await expect(
      putDramaMark(token, 999, { status: 'seen' }, respond(404, { requestId: 'r1' })),
    ).rejects.toMatchObject({ kind: 'failed', requestId: 'r1' });
  });
});
