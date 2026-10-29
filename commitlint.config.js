// Conventional Commits (ADR-0027).
export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot bodies carry long release-note lines and URLs that exceed body-max-line-length.
  ignores: [(message) => message.includes('Signed-off-by: dependabot[bot]')],
};
