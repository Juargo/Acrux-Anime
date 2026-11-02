import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../../db/client.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { createProfileRepository } from './profile.repository.js';

// Runs against the real migrations, connected as acrux_api like the API in production.
const apiDir = fileURLToPath(new URL('../../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL_UNPOOLED: container.getConnectionUri() },
    stdio: 'pipe',
  });
  const owner = new pg.Client({ connectionString: container.getConnectionUri() });
  await owner.connect();
  await owner.query(`ALTER ROLE acrux_api WITH LOGIN PASSWORD 'api-test'`);
  await owner.end();
  const url = new URL(container.getConnectionUri());
  url.username = 'acrux_api';
  url.password = 'api-test';
  prisma = createPrismaClient(url.toString());
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await container?.stop();
});

describe('profile repository', () => {
  it('creates the profile on first use with a private list counted by franchise', async () => {
    const profiles = createProfileRepository(prisma);
    const profile = await profiles.findOrCreate('6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f71', {
      displayName: 'Camila',
      avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
    });
    expect(profile).toEqual({
      displayName: 'Camila',
      avatarUrl: 'https://lh3.googleusercontent.com/a/camila',
      locale: 'es',
      listVisibility: 'private',
      counterMode: 'franchise',
    });
  });

  it('keeps the stored profile on later sign-ins, even if Google changed the name', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f72';
    await profiles.findOrCreate(userId, { displayName: 'Camila', avatarUrl: null });
    const again = await profiles.findOrCreate(userId, { displayName: 'Cami', avatarUrl: null });
    expect(again.displayName).toBe('Camila');
  });

  it('creates a single profile when the first requests arrive together', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f73';
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        profiles.findOrCreate(userId, { displayName: 'Camila', avatarUrl: null }),
      ),
    );
    expect(results.every((profile) => profile.displayName === 'Camila')).toBe(true);
    expect(await prisma.profile.count({ where: { userId } })).toBe(1);
  });
});
