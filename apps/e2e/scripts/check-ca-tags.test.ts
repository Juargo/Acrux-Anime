import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkTags, formatReport } from './check-ca-tags.ts';

// Built at runtime: literal tags here would count as tests of the real criteria.
const ca = (id: string) => `@${'CA'}-${id}`;

const roots: string[] = [];

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'acrux-tags-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const feature = (...tags: string[]) =>
  `# language: es\nCaracterística: x\n${tags.map((tag) => `  ${tag}\n  Escenario: y\n`).join('')}`;

describe('checkTags', () => {
  it('finds the criteria that no test cites', () => {
    const root = repo({
      'docs/criterios/RF-20.feature': feature(ca('RF20-01'), ca('RF20-02')),
      'apps/web/src/a.test.tsx': `it('${ca('RF20-01')} marks a franchise', () => {});`,
    });
    expect(checkTags(root)).toEqual({ criteria: 2, untested: [ca('RF20-02')], unknown: [] });
  });

  it('counts tests in every app and package, including Playwright specs', () => {
    const root = repo({
      'docs/criterios/RF-06.feature': feature(ca('RF06-01')),
      'docs/criterios/RF-42.feature': feature(ca('RF42-01')),
      'packages/domain/src/b.test.ts': `it('${ca('RF42-01')} hides it', () => {});`,
      'apps/e2e/tests/delete.spec.ts': `test('${ca('RF06-01')} deletes the account', () => {});`,
    });
    expect(checkTags(root).untested).toEqual([]);
  });

  it('ignores tags in source files that are not tests, and in node_modules', () => {
    const root = repo({
      'docs/criterios/RF-30.feature': feature(ca('RF30-01')),
      'apps/web/src/CardScreen.tsx': `// ${ca('RF30-01')} is tested elsewhere`,
      'apps/web/node_modules/x/y.test.ts': "it(ca('RF30-01'), () => {});",
    });
    expect(checkTags(root).untested).toEqual([ca('RF30-01')]);
  });

  it('reports tests that cite a criterion no feature file defines', () => {
    const root = repo({
      'docs/criterios/RF-20.feature': feature(ca('RF20-01')),
      'apps/web/src/a.test.tsx': `it('${ca('RF20-01')} and ${ca('RF99-01')}', () => {});`,
    });
    expect(checkTags(root).unknown).toEqual([ca('RF99-01')]);
  });
});

describe('formatReport', () => {
  it('prints GitHub warnings, one per tag, and a summary', () => {
    const report = formatReport({
      criteria: 3,
      untested: [ca('RF20-02')],
      unknown: [ca('RF99-01')],
    });
    expect(report).toEqual([
      `::warning title=Criterio sin prueba::${ca('RF20-02')} no aparece en ninguna prueba (ADR-0029)`,
      `::warning title=Etiqueta desconocida::${ca('RF99-01')} no está en docs/criterios`,
      '2 de 3 criterios tienen prueba.',
    ]);
  });
});
