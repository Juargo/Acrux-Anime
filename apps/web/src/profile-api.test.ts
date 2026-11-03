import { describe, expect, it, vi } from 'vitest';
import { fetchMe, saveCounterMode } from './profile-api';

const profile = {
  displayName: 'Camila',
  avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
  locale: 'es',
  listVisibility: 'private',
  counterMode: 'franchise',
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
