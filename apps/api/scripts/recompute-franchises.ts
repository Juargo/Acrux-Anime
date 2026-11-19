import { createPrismaClient } from '../src/db/client.js';
import { storeFranchises } from './franchises.js';

// pnpm --filter @acrux/api catalog:franchises
// Recomputes the franchise root and first year of every anime (ADR-0045) without loading
// anything from MyAnimeList. It needs DATABASE_URL; the catalog load job runs the same step
// after each load.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const prisma = createPrismaClient(databaseUrl);
try {
  await storeFranchises(prisma);
} finally {
  await prisma.$disconnect();
}
