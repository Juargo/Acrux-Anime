import { createPrismaClient } from '../src/db/client.js';
import { createMyAnimeListSource } from '../src/modules/catalog/adapters/myanimelist.js';
import { createCatalogRepository } from '../src/modules/catalog/repositories/catalog.repository.js';
import { loadCatalog } from '../src/modules/catalog/services/catalog-loader.js';
import { storeFranchises } from './franchises.js';
import { option } from './option.js';

// pnpm --filter @acrux/api catalog:load [--details=6000] [--delay=1000]
// Copies the catalog of MyAnimeList into the `anime` table (ADR-0043, point 3). It needs
// MAL_CLIENT_ID and DATABASE_URL; in production the connection uses the acrux_catalog role.
// It ends by storing the franchise of every anime (ADR-0045).
// See docs/runbooks/catalogo.md.
const maxDetails = option('details', 6000, 0, 40_000);
// Never faster than two requests per second (S7).
const delayMs = option('delay', 1000, 500, 60_000);
const clientId = process.env.MAL_CLIENT_ID;
const databaseUrl = process.env.DATABASE_URL;
if (!clientId || !databaseUrl) {
  console.error('MAL_CLIENT_ID and DATABASE_URL are required');
  process.exit(2);
}

const prisma = createPrismaClient(databaseUrl);
try {
  const result = await loadCatalog({
    source: createMyAnimeListSource({ clientId }),
    store: createCatalogRepository(prisma),
    maxDetails,
    delayMs,
    log: (message) => console.log(message),
  });
  console.log(
    `listed ${result.listed}, detailed ${result.detailed}, gone from the source ${result.gone}`,
  );
  if (result.stopped) {
    console.error(`stopped early: ${result.stopped}`);
    process.exitCode = 1;
  }
  // Also after a load that stopped early: what it did store may have changed franchises.
  // A failure here fails the job.
  await storeFranchises(prisma);
} finally {
  await prisma.$disconnect();
}
