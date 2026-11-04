import { describe, expect, it, vi } from 'vitest';
import { fetchPublicMarks, fetchPublicProfile, PublicProfileError } from './api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const summary = {
  handle: 'camila',
  displayName: 'Camila',
  avatarUrl: null,
  listVisibility: 'public',
  shownTotal: 48,
  shownMode: 'franchise',
};

describe('fetchPublicProfile', () => {
  it('reads the summary without a session', async () => {
    const fetchFn = vi.fn(async () => json(summary));
    await expect(fetchPublicProfile('camila', fetchFn)).resolves.toEqual(summary);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/profiles/camila', {});
  });

  it('answers null for an unknown handle', async () => {
    const fetchFn = vi.fn(async () => json({ status: 404, code: 'profiles.not_found' }, 404));
    await expect(fetchPublicProfile('nadie', fetchFn)).resolves.toBeNull();
  });

  it('does not ask the API for something that cannot be a handle', async () => {
    const fetchFn = vi.fn();
    await expect(fetchPublicProfile('Ca/../me', fetchFn)).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('fails on other errors and when the network is down', async () => {
    await expect(fetchPublicProfile('camila', async () => json({}, 503))).rejects.toBeInstanceOf(
      PublicProfileError,
    );
    await expect(
      fetchPublicProfile('camila', async () => {
        throw new TypeError('offline');
      }),
    ).rejects.toBeInstanceOf(PublicProfileError);
  });
});

describe('fetchPublicMarks', () => {
  const mark = (anilistId: number) => ({
    anilistId,
    malId: null,
    status: 'seen',
    markedAt: '2026-10-10T12:00:00.000Z',
  });

  it('reads every page of a public list', async () => {
    const fetchFn = vi.fn(async (url: string) =>
      url.includes('cursor=')
        ? json({ items: [mark(30)], nextCursor: null })
        : json({ items: [mark(10), mark(20)], nextCursor: '20' }),
    );
    const marks = await fetchPublicMarks('camila', fetchFn as unknown as typeof fetch);
    expect(marks?.map((item) => item.anilistId)).toEqual([10, 20, 30]);
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
      '/api/v1/profiles/camila/marks?limit=1000',
      '/api/v1/profiles/camila/marks?limit=1000&cursor=20',
    ]);
  });

  it('answers null when the list is private or the handle unknown', async () => {
    const fetchFn = vi.fn(async () => json({ status: 404, code: 'profiles.not_found' }, 404));
    await expect(fetchPublicMarks('nami', fetchFn)).resolves.toBeNull();
  });

  it('fails on a cursor that does not move forward', async () => {
    const fetchFn = vi.fn(async () => json({ items: [mark(10)], nextCursor: '5' }));
    await expect(fetchPublicMarks('camila', fetchFn)).rejects.toBeInstanceOf(PublicProfileError);
  });
});
