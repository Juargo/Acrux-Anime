import { describe, expect, it } from 'vitest';
import { createPostHogPersons } from './posthog-persons.js';

function fakeFetch(status: number) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response('{}', { status });
  };
  return { calls, fetchFn };
}

const options = { apiKey: 'phx_key', projectId: '328147', host: 'https://eu.posthog.com' };

describe('PostHog persons', () => {
  it('asks PostHog to delete the person of the distinct id with the personal API key', async () => {
    const { calls, fetchFn } = fakeFetch(202);
    await createPostHogPersons({ ...options, fetchFn }).deletePerson('abc123');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://eu.posthog.com/api/projects/328147/persons/bulk_delete/');
    expect(calls[0]?.init?.method).toBe('POST');
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer phx_key');
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ distinct_ids: ['abc123'] });
  });

  it('fails when PostHog refuses', async () => {
    const { fetchFn } = fakeFetch(403);
    await expect(
      createPostHogPersons({ ...options, fetchFn }).deletePerson('abc123'),
    ).rejects.toThrow('PostHog answered 403');
  });
});
