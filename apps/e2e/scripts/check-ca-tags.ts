// Warns when an acceptance criterion (`@CA-…` in docs/criterios) is cited by no test (ADR-0029).
// It never fails the build: the definition of done asks for the test, CI only reminds.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = /@CA-[A-Z0-9]+-\d{2}\b/g;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const SKIPPED = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  'test-results',
  'playwright-report',
]);

export interface TagReport {
  criteria: number;
  untested: string[];
  unknown: string[];
}

function* files(dir: string): Generator<string> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIPPED.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

const tagsIn = (text: string) => new Set(text.match(TAG) ?? []);

export function checkTags(root: string): TagReport {
  const criteria = new Set<string>();
  for (const path of files(join(root, 'docs/criterios'))) {
    if (path.endsWith('.feature'))
      for (const tag of tagsIn(readFileSync(path, 'utf8'))) criteria.add(tag);
  }
  const cited = new Set<string>();
  for (const area of ['apps', 'packages']) {
    for (const path of files(join(root, area))) {
      if (TEST_FILE.test(relative(root, path))) {
        for (const tag of tagsIn(readFileSync(path, 'utf8'))) cited.add(tag);
      }
    }
  }
  return {
    criteria: criteria.size,
    untested: [...criteria].filter((tag) => !cited.has(tag)).sort(),
    unknown: [...cited].filter((tag) => !criteria.has(tag)).sort(),
  };
}

export function formatReport({ criteria, untested, unknown }: TagReport): string[] {
  return [
    ...untested.map(
      (tag) =>
        `::warning title=Criterio sin prueba::${tag} no aparece en ninguna prueba (ADR-0029)`,
    ),
    ...unknown.map(
      (tag) => `::warning title=Etiqueta desconocida::${tag} no está en docs/criterios`,
    ),
    `${criteria - untested.length} de ${criteria} criterios tienen prueba.`,
  ];
}

// Run directly (node scripts/check-ca-tags.ts), not when the tests import it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '../../..');
  for (const line of formatReport(checkTags(root))) console.log(line);
}
