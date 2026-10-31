// Layer rules of ADR-0019, checked in CI (ADR-0027).
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'routes-not-to-repositories',
      comment: 'Rule 3: a route never reaches Prisma; it goes through a service.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes' },
      to: { path: '^src/modules/[^/]+/repositories|^src/generated/prisma' },
    },
    {
      name: 'dependencies-go-down',
      comment: 'Rule 1: routes -> services -> repositories/adapters, never upwards.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/(services|repositories|adapters)' },
      to: { path: '^src/modules/[^/]+/routes' },
    },
    {
      name: 'repositories-not-to-services',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/(repositories|adapters)' },
      to: { path: '^src/modules/[^/]+/services' },
    },
    {
      name: 'no-foreign-repositories',
      comment: "Rule 4: a module reaches another module's tables only through its service.",
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/([^/]+)/repositories', pathNot: '^src/modules/$1/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
