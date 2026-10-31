import { defineConfig } from 'prisma/config';

// Migrations use the direct Neon connection (DATABASE_URL_UNPOOLED, owner role, CI only).
// At runtime the API uses the pooled DATABASE_URL with the acrux_api role (ADR-0034).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? '' },
});
