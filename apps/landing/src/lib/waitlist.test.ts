import { describe, expect, it, vi } from 'vitest';
import { handleWaitlistRequest, isValidEmail } from './waitlist';

const apiKey = 'test-key';

function request(body: unknown): Request {
  return new Request('https://acruxanime.com/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function buttondown(status: number, body: unknown = {}) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe('isValidEmail', () => {
  it('accepts a complete address', () => {
    expect(isValidEmail('camila@correo.com')).toBe(true);
  });

  it('rejects an address without a domain suffix', () => {
    expect(isValidEmail('camila@correo')).toBe(false);
  });

  it('rejects spaces and empty input', () => {
    expect(isValidEmail('camila @correo.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('handleWaitlistRequest', () => {
  it('creates the subscriber in Buttondown and answers ok', async () => {
    const fetchMock = buttondown(201, { id: 'sub_1' });

    const response = await handleWaitlistRequest(request({ email: ' Camila@Correo.com ' }), {
      apiKey,
      fetch: fetchMock,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.buttondown.com/v1/subscribers');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe('Token test-key');
    // Double opt-in stays on: no "type" is sent (ADR-0033).
    expect(JSON.parse(String(init?.body))).toEqual({ email_address: 'camila@correo.com' });
  });

  it('answers already when Buttondown reports the email exists', async () => {
    const fetchMock = buttondown(400, { code: 'email_already_exists', detail: 'exists' });

    const response = await handleWaitlistRequest(request({ email: 'camila@correo.com' }), {
      apiKey,
      fetch: fetchMock,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'already' });
  });

  it('treats subscriber_already_exists the same way', async () => {
    const response = await handleWaitlistRequest(request({ email: 'camila@correo.com' }), {
      apiKey,
      fetch: buttondown(400, { code: 'subscriber_already_exists' }),
    });

    expect(await response.json()).toEqual({ status: 'already' });
  });

  it('rejects an invalid email without calling Buttondown', async () => {
    const fetchMock = buttondown(201);

    const response = await handleWaitlistRequest(request({ email: 'camila@correo' }), {
      apiKey,
      fetch: fetchMock,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'invalid' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed body', async () => {
    const response = await handleWaitlistRequest(request('not json'), {
      apiKey,
      fetch: buttondown(201),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ status: 'invalid' });
  });

  it('answers error on any other Buttondown failure', async () => {
    const response = await handleWaitlistRequest(request({ email: 'camila@correo.com' }), {
      apiKey,
      fetch: buttondown(429, { code: 'rate_limited' }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ status: 'error' });
  });

  it('answers error when Buttondown is unreachable', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });

    const response = await handleWaitlistRequest(request({ email: 'camila@correo.com' }), {
      apiKey,
      fetch: fetchMock,
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ status: 'error' });
  });

  it('answers error without calling Buttondown when the key is missing', async () => {
    const fetchMock = buttondown(201);

    const response = await handleWaitlistRequest(request({ email: 'camila@correo.com' }), {
      apiKey: undefined,
      fetch: fetchMock,
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ status: 'error' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
