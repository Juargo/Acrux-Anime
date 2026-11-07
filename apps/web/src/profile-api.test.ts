import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-errors';
import { fetchMe, patchMe, saveCounterMode } from './profile-api';

const profile = {
  displayName: 'Camila',
  avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
  handle: 'camila',
  shownTotal: null,
  shownMode: null,
  cardShared: false,
};

describe('fetchMe', () => {
  it('asks the API for the profile with the session token', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(profile));
    const result = await fetchMe(async () => 'jwt-token', fetch);
    expect(result).toEqual({ status: 'ok', profile });
    expect(fetch).toHaveBeenCalledWith('/api/v1/me', {
      headers: { Authorization: 'Bearer jwt-token' },
    });
  });

  it('treats a missing token as signed out, without calling the API', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    expect(await fetchMe(async () => null, fetch)).toEqual({ status: 'signed-out' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('treats a rejected session as signed out', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ status: 401, code: 'auth.invalid_token' }, { status: 401 }),
    );
    expect(await fetchMe(async () => 'expired', fetch)).toEqual({ status: 'signed-out' });
  });

  it('reports any other failure with its request id', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(
        { status: 503, code: 'profile.unavailable', requestId: 'req-9' },
        { status: 503 },
      ),
    );
    expect(await fetchMe(async () => 'jwt-token', fetch)).toEqual({
      status: 'error',
      requestId: 'req-9',
    });
  });
});

describe('saveCounterMode', () => {
  it('sends the mode with PATCH and the session token, and returns the profile', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ ...profile, counterMode: 'entry' }),
    );
    const saved = await saveCounterMode(async () => 'jwt-token', 'entry', fetch);
    expect(saved.counterMode).toBe('entry');
    expect(fetch).toHaveBeenCalledWith('/api/v1/me', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer jwt-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterMode: 'entry' }),
    });
  });

  it('fails without a token, without calling the API', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(saveCounterMode(async () => null, 'entry', fetch)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails when the API does not save it', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ status: 503, code: 'profile.unavailable' }, { status: 503 }),
    );
    await expect(saveCounterMode(async () => 'jwt-token', 'entry', fetch)).rejects.toThrow();
  });
});

describe('patchMe', () => {
  it('sends the changes with PATCH and the session token, and returns the profile', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ ...profile, listVisibility: 'public', cardShared: true }),
    );
    const changes = { listVisibility: 'public', cardShared: true } as const;
    const saved = await patchMe(async () => 'jwt-token', changes, fetch);
    expect(saved).toMatchObject({ listVisibility: 'public', cardShared: true });
    expect(fetch).toHaveBeenCalledWith('/api/v1/me', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer jwt-token', 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
  });

  it('fails without a session or when the API refuses', async () => {
    await expect(patchMe(async () => null, { cardShared: true }, vi.fn())).rejects.toThrow();
    await expect(
      patchMe(
        async () => 'jwt',
        { cardShared: true },
        async () => new Response(null, { status: 400 }),
      ),
    ).rejects.toThrow();
  });
});

describe('patchMe errors (ADR-0023)', () => {
  it('throws an ApiError with the code and request id of the problem', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json(
        { status: 400, code: 'profile.invalid_body', requestId: 'r9' },
        { status: 400 },
      ),
    );
    const error = await patchMe(async () => 'jwt', { displayName: '' }, fetch).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'profile.invalid_body', requestId: 'r9' });
  });
});
