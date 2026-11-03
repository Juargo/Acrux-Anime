import { defineConfig } from 'vitest/config';

// ADR-0029, rule 1: at least 90 % coverage in packages/domain, checked in CI by `pnpm test`.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__fixtures__/**'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
