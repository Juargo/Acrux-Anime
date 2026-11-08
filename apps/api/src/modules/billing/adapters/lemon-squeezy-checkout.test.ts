import { describe, expect, it } from 'vitest';
import { createLemonSqueezyCheckout } from './lemon-squeezy-checkout.js';

const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const CHECKOUT_URL = 'https://acrux.lemonsqueezy.com/checkout/custom/abc?signature=x';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchFn };
}

const options = { apiKey: 'ls-key', storeId: '11', variantId: '22' };
const created = { data: { type: 'checkouts', id: 'abc', attributes: { url: CHECKOUT_URL } } };

describe('Lemon Squeezy checkout', () => {
  it('creates a checkout for the variant with the user id in the custom data (S2)', async () => {
    const { calls, fetchFn } = fakeFetch(201, created);

    const url = await createLemonSqueezyCheckout({ ...options, fetchFn }).create({
      userId: USER,
      redirectUrl: 'https://app.acruxanime.com/perfil/plus?compra=lista',
    });

    expect(url).toBe(CHECKOUT_URL);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.lemonsqueezy.com/v1/checkouts');
    expect(calls[0]?.init?.method).toBe('POST');
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer ls-key');
    expect(headers.get('content-type')).toBe('application/vnd.api+json');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: {
            redirect_url: 'https://app.acruxanime.com/perfil/plus?compra=lista',
            enabled_variants: [22],
          },
          checkout_data: { custom: { user_id: USER } },
        },
        relationships: {
          store: { data: { type: 'stores', id: '11' } },
          variant: { data: { type: 'variants', id: '22' } },
        },
      },
    });
  });

  it('fails on an error answer, without the response body in the message', async () => {
    const { fetchFn } = fakeFetch(422, { errors: [{ detail: 'secret detail' }] });
    const checkout = createLemonSqueezyCheckout({ ...options, fetchFn }).create({
      userId: USER,
      redirectUrl: 'https://app.acruxanime.com/perfil/plus',
    });
    await expect(checkout).rejects.toThrow('Lemon Squeezy answered 422');
  });

  it('fails when the answer carries no checkout URL', async () => {
    const { fetchFn } = fakeFetch(201, { data: { attributes: {} } });
    const checkout = createLemonSqueezyCheckout({ ...options, fetchFn }).create({
      userId: USER,
      redirectUrl: 'https://app.acruxanime.com/perfil/plus',
    });
    await expect(checkout).rejects.toThrow('Lemon Squeezy gave no checkout URL');
  });
});
