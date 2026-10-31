import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContainer } from '../src/container.js';
import { openApiJsonDiverges, renderOpenApiJson } from '../src/openapi/document.js';

// pnpm --filter @acrux/api openapi:emit   regenerates apps/api/openapi.json
// pnpm --filter @acrux/api openapi:check  fails (exit 1) when the file is stale; runs in CI
const output = fileURLToPath(new URL('../openapi.json', import.meta.url));
const { modules } = createContainer({});

if (!process.argv.includes('--check')) {
  writeFileSync(output, renderOpenApiJson(modules), 'utf-8');
  console.log(`openapi.json regenerated: ${output}`);
} else if (!existsSync(output)) {
  console.error('openapi.json is missing. Run `pnpm --filter @acrux/api openapi:emit`.');
  process.exit(1);
} else if (openApiJsonDiverges(readFileSync(output, 'utf-8'), modules)) {
  console.error(
    'openapi.json is stale. Run `pnpm --filter @acrux/api openapi:emit` and commit it.',
  );
  process.exit(1);
} else {
  console.log('openapi.json is up to date.');
}
