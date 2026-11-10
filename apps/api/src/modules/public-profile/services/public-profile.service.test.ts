import { describe, expect, it } from 'vitest';
import type { UserPlan } from '../../../http/plan.js';
import type { ProfileService } from '../../profile/services/profile.service.js';
import { createPublicProfileService } from './public-profile.service.js';

const OWNER = '7b1c2a3e-8b7d-4c1e-9a2f-0000000000c3';

type Row = NonNullable<Awaited<ReturnType<ProfileService['findByHandle']>>>;

function serviceFor(row: Partial<Row>, plan: UserPlan) {
  const profiles: Pick<ProfileService, 'findByHandle'> = {
    findByHandle: async () => ({
      userId: OWNER,
      handle: 'camila',
      displayName: 'Camila',
      avatarUrl: null,
      avatarPreset: null,
      listVisibility: 'public',
      shownTotal: 48,
      shownMode: 'franchise',
      ...row,
    }),
  };
  const asked: string[] = [];
  const planOf = async (userId: string) => {
    asked.push(userId);
    return plan;
  };
  const marks = { listOf: async () => ({ items: [], nextCursor: null }) };
  return { service: createPublicProfileService(profiles, marks, planOf), asked };
}

describe('public summary (RF-55)', () => {
  it('hides a Plus avatar of an owner who is not Plus, so a refund takes it back', async () => {
    const { service, asked } = serviceFor({ avatarPreset: 'sakura' }, 'free');
    const summary = await service.summary('camila');
    expect(summary?.avatarPreset).toBeNull();
    expect(summary).not.toHaveProperty('userId');
    expect(asked).toEqual([OWNER]);
  });

  it('shows a Plus avatar of a Plus owner', async () => {
    const { service } = serviceFor({ avatarPreset: 'sakura' }, 'plus');
    expect((await service.summary('camila'))?.avatarPreset).toBe('sakura');
  });

  it('keeps a free avatar whatever the plan', async () => {
    const { service } = serviceFor({ avatarPreset: 'coral' }, 'free');
    expect((await service.summary('camila'))?.avatarPreset).toBe('coral');
  });
});
