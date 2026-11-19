import { groupFranchises } from '@acrux/domain';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { createCatalogRepository } from '../src/modules/catalog/repositories/catalog.repository.js';
import {
  type GroupFranchises,
  recomputeFranchises,
} from '../src/modules/catalog/services/franchise-recompute.js';

// The stored relation names are plain strings; the grouping ignores the ones it does not know.
const group = groupFranchises as unknown as GroupFranchises;

// Stores the franchise root and first year of every anime (ADR-0045, point 3). Scripts run
// with tsx, which loads the TypeScript sources of @acrux/domain the compiled API cannot.
export async function storeFranchises(prisma: PrismaClient) {
  const result = await recomputeFranchises({ store: createCatalogRepository(prisma), group });
  console.log(`franchises: examined ${result.examined}, changed ${result.changed}`);
}
