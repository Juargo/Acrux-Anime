import { describe, expect, it } from 'vitest';
import { createNeonAuthAdmin } from './neon-auth-admin.js';

const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';

function fakeFetch(status: number) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(status === 200 ? '{}' : '{"message":"no"}', { status });
  };
  return { calls, fetchFn };
}

const options = { apiKey: 'neon-key', projectId: 'proj-1', branchId: 'br-1' };

describe('Neon Auth admin', () => {
  it('deletes the user of the branch with the API key', async () => {
    const { calls, fetchFn } = fakeFetch(200);
    await createNeonAuthAdmin({ ...options, fetchFn }).deleteUser(USER);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      `https://console.neon.tech/api/v2/projects/proj-1/branches/br-1/auth/users/${USER}`,
    );
    expect(calls[0]?.init?.method).toBe('DELETE');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer neon-key');
  });

  it('takes a user that no longer exists as deleted, so a retry finishes', async () => {
    const { fetchFn } = fakeFetch(404);
    await expect(
      createNeonAuthAdmin({ ...options, fetchFn }).deleteUser(USER),
    ).resolves.toBeUndefined();
  });

  it('fails on any other answer, without the response body in the message', async () => {
    const { fetchFn } = fakeFetch(500);
    const deletion = createNeonAuthAdmin({ ...options, fetchFn }).deleteUser(USER);
    await expect(deletion).rejects.toThrow('Neon Auth answered 500');
  });
});
