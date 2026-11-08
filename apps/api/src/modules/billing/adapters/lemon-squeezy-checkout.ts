// Port to the payment provider: the API creates the checkout, so the user id the webhook
// reads back is the session's, never the client's (ADR-0025, S2, S10).
export interface CheckoutPort {
  // Resolves to the URL of the provider's checkout page.
  create(input: { userId: string; redirectUrl: string }): Promise<string>;
}

const TIMEOUT_MS = 10_000;

// POST /v1/checkouts of the Lemon Squeezy API. A test-mode API key creates test checkouts.
export function createLemonSqueezyCheckout(options: {
  apiKey: string;
  storeId: string;
  variantId: string;
  fetchFn?: typeof fetch;
}): CheckoutPort {
  const fetchFn = options.fetchFn ?? fetch;
  return {
    create: async ({ userId, redirectUrl }) => {
      const response = await fetchFn('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              product_options: {
                redirect_url: redirectUrl,
                enabled_variants: [Number(options.variantId)],
              },
              checkout_data: { custom: { user_id: userId } },
            },
            relationships: {
              store: { data: { type: 'stores', id: options.storeId } },
              variant: { data: { type: 'variants', id: options.variantId } },
            },
          },
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The body may hold provider details; only the status goes into the error.
      if (!response.ok) throw new Error(`Lemon Squeezy answered ${response.status}`);
      const body = (await response.json()) as { data?: { attributes?: { url?: unknown } } };
      const url = body.data?.attributes?.url;
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        throw new Error('Lemon Squeezy gave no checkout URL');
      }
      return url;
    },
  };
}
