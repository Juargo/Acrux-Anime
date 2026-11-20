import { createPrismaClient } from '../src/db/client.js';
import { createTvmazeSource } from '../src/modules/dramas/adapters/tvmaze.js';
import { createDramaRepository } from '../src/modules/dramas/repositories/drama.repository.js';
import { loadDramas } from '../src/modules/dramas/services/drama-loader.js';
import { option } from './option.js';

// pnpm --filter @acrux/api dramas:load [--details=12000] [--delay=600]
// Copies the live-action dramas of TVmaze into the `drama` table (ADR-0046, point 3). It
// needs DATABASE_URL and no key; in production the connection uses the acrux_dramas role.
// See docs/runbooks/dramas.md.
const maxDetails = option('details', 12_000, 0, 40_000);
// TVmaze allows 20 requests every 10 seconds: never faster than that.
const delayMs = option('delay', 600, 500, 60_000);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const prisma = createPrismaClient(databaseUrl);
try {
  const result = await loadDramas({
    source: createTvmazeSource(),
    store: createDramaRepository(prisma),
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
