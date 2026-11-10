// Client for the curator table (#42, RF-60, ADR-0024): read by anyone, written by the curator.
import type { FranchiseOverride } from '@acrux/domain';
import { z } from 'zod';

export type OverrideRole = FranchiseOverride['role'];
export type OverrideErrorKind = 'signed-out' | 'forbidden' | 'invalid' | 'failed';

export class FranchiseOverridesError extends Error {
  constructor(
    readonly kind: OverrideErrorKind,
    readonly requestId?: string,
  ) {
    super(`Franchise overrides request ${kind}`);
    this.name = 'FranchiseOverridesError';
  }
}

const id = z.int().min(1);
const override = z.object({
  animeId: id,
  franchiseRootId: id,
  role: z.enum(['core', 'extra', 'separate']),
  updatedAt: z.iso.datetime(),
});
const table = z.object({ items: z.array(override) });

async function problemOf(response: Response): Promise<string | undefined> {
  const problem = (await response.json().catch(() => ({}))) as { requestId?: string };
  return problem.requestId;
}

// The whole table or an error: grouping with part of it could split a saga for a while.
export async function fetchFranchiseOverrides(
  fetchFn: typeof fetch = fetch,
): Promise<FranchiseOverride[]> {
  let response: Response;
  try {
    response = await fetchFn('/api/v1/franchise-overrides');
  } catch {
    throw new FranchiseOverridesError('failed');
  }
  if (!response.ok) throw new FranchiseOverridesError('failed', await problemOf(response));
  const body = table.safeParse(await response.json().catch(() => null));
  if (!body.success) throw new FranchiseOverridesError('failed');
  return body.data.items;
}

export async function saveFranchiseOverride(
  getToken: () => Promise<string | null>,
  animeId: number,
  correction: { franchiseRootId: number; role: OverrideRole },
  fetchFn: typeof fetch = fetch,
): Promise<FranchiseOverride> {
  const token = await getToken();
  if (!token) throw new FranchiseOverridesError('signed-out');
  let response: Response;
  try {
    response = await fetchFn(`/api/v1/franchise-overrides/${animeId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(correction),
    });
  } catch {
    throw new FranchiseOverridesError('failed');
  }
  if (response.status === 401) throw new FranchiseOverridesError('signed-out');
  if (response.status === 403) throw new FranchiseOverridesError('forbidden');
  if (response.status === 400) throw new FranchiseOverridesError('invalid');
  if (!response.ok) throw new FranchiseOverridesError('failed', await problemOf(response));
  return override.parse(await response.json());
}
