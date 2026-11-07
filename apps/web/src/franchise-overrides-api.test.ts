import { describe, expect, it, vi } from 'vitest';
import {
  FranchiseOverridesError,
  fetchFranchiseOverrides,
  saveFranchiseOverride,
} from './franchise-overrides-api';

const row = {
  anilistId: 20811,
  franchiseRootId: 16498,
  role: 'extra',
  updatedAt: '2026-11-07T12:00:00.000Z',
};

describe('fetchFranchiseOverrides', () => {
  it('reads the curator table without a session', async () => {
    const fetchFn = vi.fn(async () => Response.json({ items: [row] }));

    expect(await fetchFranchiseOverrides(fetchFn)).toEqual([row]);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/franchise-overrides');
  });

  it('fails on an error or an unexpected body, so grouping never uses half a table', async () => {
    await expect(
      fetchFranchiseOverrides(async () => new Response(null, { status: 503 })),
    ).rejects.toBeInstanceOf(FranchiseOverridesError);
    await expect(
      fetchFranchiseOverrides(async () => Response.json({ items: [{ ...row, role: 'main' }] })),
    ).rejects.toBeInstanceOf(FranchiseOverridesError);
  });
});

describe('saveFranchiseOverride', () => {
  it('sends the correction with the session token and returns the stored row', async () => {
    const fetchFn = vi.fn(async () => Response.json(row));

    const saved = await saveFranchiseOverride(
      async () => 'token',
      20811,
      { franchiseRootId: 16498, role: 'extra' },
      fetchFn,
    );

    expect(saved).toEqual(row);
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/franchise-overrides/20811', {
      method: 'PUT',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ franchiseRootId: 16498, role: 'extra' }),
    });
  });

  it('tells a missing curator role apart from other failures', async () => {
    const save = (status: number) =>
      saveFranchiseOverride(
        async () => 'token',
        1,
        { franchiseRootId: 1, role: 'core' },
        async () => Response.json({ requestId: 'req-1' }, { status }),
      );
    await expect(save(403)).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(save(400)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(save(500)).rejects.toMatchObject({ kind: 'failed', requestId: 'req-1' });
  });
});
