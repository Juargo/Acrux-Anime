import { createPrismaClient } from '../src/db/client.js';
import { createMyAnimeListSource } from '../src/modules/catalog/adapters/myanimelist.js';
import { createCatalogRepository } from '../src/modules/catalog/repositories/catalog.repository.js';
import { loadCatalog } from '../src/modules/catalog/services/catalog-loader.js';

// pnpm --filter @acrux/api catalog:load [--details=6000] [--delay=1000]
// Copies the catalog of MyAnimeList into the `anime` table (ADR-0043, point 3). It needs
// MAL_CLIENT_ID and DATABASE_URL; in production the connection uses the acrux_catalog role.
// See docs/runbooks/catalogo.md.
function option(name: string, fallback: number, min: number, max: number): number {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  if (raw === undefined || raw === '') return fallback;
  const value = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!(value >= min && value <= max)) {
    console.error(`--${name} must be a whole number from ${min} to ${max}`);
    process.exit(2);
  }
  return value;
}

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
} finally {
  await prisma.$disconnect();
}
