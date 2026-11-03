// ADR-0019, rule 2: packages/domain has no I/O and depends on nothing outside itself.
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
      name: 'domain-stays-pure',
      comment: 'No packages, Node built-ins or app code: only files inside packages/domain/src.',
      severity: 'error',
      from: { path: '^src/', pathNot: '\\.test\\.ts$' },
      to: { pathNot: '^src/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
