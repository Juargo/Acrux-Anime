import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // ADR-0022, ADR-0034: the API is the only way into the database
  dataApi: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (branch.name === 'dev') {
      // Long-lived development environment: never expires
      return { parent: 'production' };
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: '7d' };
    }
    // Existing branch: no changes
    return {};
  },
});
