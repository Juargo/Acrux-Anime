import type { PrismaClient } from '../../../generated/prisma/client.js';

export type FranchiseRole = 'core' | 'extra' | 'separate';

// One row of the curator table (RDI-15): MyAnimeList ids only, no titles or covers.
export interface FranchiseOverrideRow {
  animeId: number;
  franchiseRootId: number;
  role: FranchiseRole;
  // When the row last changed. The domain counts a core entry only from this moment, so
  // a correction never takes from anyone's total (RF-60).
  updatedAt: Date;
}

export interface FranchiseOverridesRepository {
  // Every row, ordered by animeId; the table holds a few hundred rows.
  list(): Promise<FranchiseOverrideRow[]>;
  // Insert or replace the row; updatedAt moves to now() either way.
  upsert(row: Omit<FranchiseOverrideRow, 'updatedAt'>): Promise<FranchiseOverrideRow>;
}

const columns = { animeId: true, franchiseRootId: true, role: true, updatedAt: true } as const;

export function createFranchiseOverridesRepository(
  prisma: PrismaClient,
): FranchiseOverridesRepository {
  return {
    list: () => prisma.franchiseOverride.findMany({ orderBy: { animeId: 'asc' }, select: columns }),
    upsert: ({ animeId, franchiseRootId, role }) =>
      prisma.franchiseOverride.upsert({
        where: { animeId },
        create: { animeId, franchiseRootId, role },
        // Set explicitly: an identical row must still move forward in time (RF-60).
        update: { franchiseRootId, role, updatedAt: new Date() },
        select: columns,
      }),
  };
}
