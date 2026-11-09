// Client for POST /api/v1/billing/checkout (epic #50). The API takes the user from the session,
// so the request has no body (S10).
import { apiError } from './api-errors';

export async function startCheckout(
  getToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('Signed out');
  const response = await fetchFn('/api/v1/billing/checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw await apiError(response, `Starting the checkout failed with ${response.status}`);
  const { url } = (await response.json()) as { url: string };
  return url;
}
