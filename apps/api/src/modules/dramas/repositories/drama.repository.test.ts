import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../../db/client.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { createDramaRepository, type DramaInput } from './drama.repository.js';

// Runs against the real migrations, connected as acrux_dramas like the load job in production.
const apiDir = fileURLToPath(new URL('../../../..', import.meta.url));
let container: StartedPostgreSqlContainer;
let owner: pg.Client;
let prisma: PrismaClient;

const listed = (id: number, overrides: Partial<DramaInput> = {}): DramaInput => ({
  id,
  title: `Drama ${id}`,
  searchText: `drama ${id}`,
  summary: null,
  coverUrl: null,
  tvmazeUrl: `https://www.tvmaze.com/shows/${id}/drama`,
  country: 'KR',
  language: 'Korean',
  startDate: null,
  year: null,
  durationMinutes: null,
  genres: [],
  status: null,
  weight: 0,
  imdbId: null,
  thetvdbId: null,
  sourceUpdatedAt: new Date('2026-11-01T00:00:00.000Z'),
  ...overrides,
});

const untamed = listed(42806, {
  title: 'The Untamed',
  searchText: 'the untamed',
  summary: 'The pugilist world is ruled by the Wen clan.',
  coverUrl: 'https://static.tvmaze.com/uploads/images/original_untouched/236/592104.jpg',
  tvmazeUrl: 'https://www.tvmaze.com/shows/42806/the-untamed',
  country: 'CN',
  language: 'Chinese',
  startDate: new Date('2019-06-27T00:00:00.000Z'),
  year: 2019,
  durationMinutes: 46,
  genres: ['Drama', 'Romance', 'Mystery'],
  status: 'Ended',
  weight: 66,
  imdbId: 'tt10554898',
  thetvdbId: 355148,
});
const untamedDetail: DramaInput = {
  ...untamed,
  aliases: ['陈情令', 'Chén Qíng Lìng'],
  searchText: 'the untamed 陈情令 chén qíng lìng',
  seasons: 1,
  episodes: 50,
};

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL_UNPOOLED: container.getConnectionUri() },
    stdio: 'pipe',
  });
  owner = new pg.Client({ connectionString: container.getConnectionUri() });
  await owner.connect();
  await owner.query(`ALTER ROLE acrux_dramas WITH LOGIN PASSWORD 'dramas-test'`);
  const url = new URL(container.getConnectionUri());
  url.username = 'acrux_dramas';
  url.password = 'dramas-test';
  prisma = createPrismaClient(url.toString());
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await owner?.end();
  await container?.stop();
});

beforeEach(async () => {
  await owner.query('DELETE FROM drama');
});

describe('saveListed', () => {
  it('creates a drama with what the index knows, and no detail yet', async () => {
    await createDramaRepository(prisma).saveListed([untamed]);

    const row = await prisma.drama.findUniqueOrThrow({ where: { id: 42806 } });
    expect(row).toMatchObject({
      ...untamed,
      aliases: [],
      seasons: null,
      episodes: null,
      detailedAt: null,
    });
  });

  it('updates a drama it already has instead of adding another', async () => {
    const store = createDramaRepository(prisma);
    await store.saveListed([untamed, listed(2)]);
    await store.saveListed([{ ...untamed, status: 'Running', weight: 70 }]);

    expect(await prisma.drama.count()).toBe(2);
    const row = await prisma.drama.findUniqueOrThrow({ where: { id: 42806 } });
    expect(row).toMatchObject({ status: 'Running', weight: 70 });
  });

  it('keeps two dramas with the same title as two rows', async () => {
    await createDramaRepository(prisma).saveListed([
      listed(1, { title: 'Ashes of Love' }),
      listed(2, { title: 'Ashes of Love' }),
    ]);
    const rows = await prisma.drama.findMany({ where: { title: 'Ashes of Love' } });
    expect(rows.map((row) => row.id).sort()).toEqual([1, 2]);
  });

  it('keeps the aliases, the counts and the names to search by of a detail already read', async () => {
    const store = createDramaRepository(prisma);
    await store.saveDetailed(untamedDetail);
    await store.saveListed([untamed]);

    const row = await prisma.drama.findUniqueOrThrow({ where: { id: 42806 } });
    expect(row).toMatchObject({
      aliases: ['陈情令', 'Chén Qíng Lìng'],
      searchText: 'the untamed 陈情令 chén qíng lìng',
      seasons: 1,
      episodes: 50,
    });
    expect(row.detailedAt).not.toBeNull();
  });
});

describe('saveDetailed', () => {
  it('stores the aliases, seasons and episodes of a drama already listed', async () => {
    const store = createDramaRepository(prisma);
    await store.saveListed([untamed]);
    await store.saveDetailed(untamedDetail);

    expect(await prisma.drama.count()).toBe(1);
    const row = await prisma.drama.findUniqueOrThrow({ where: { id: 42806 } });
    expect(row).toMatchObject({
      title: 'The Untamed',
      aliases: ['陈情令', 'Chén Qíng Lìng'],
      searchText: 'the untamed 陈情令 chén qíng lìng',
      seasons: 1,
      episodes: 50,
      tvmazeUrl: 'https://www.tvmaze.com/shows/42806/the-untamed',
    });
    expect(row.detailedAt).not.toBeNull();
  });
});

describe('nextToDetail', () => {
  it('asks first for the dramas never read, most popular first, then the changed ones', async () => {
    const store = createDramaRepository(prisma);
    await store.saveListed([
      listed(1, { weight: 10 }),
      listed(2, { weight: 90 }),
      listed(3, { weight: 50 }),
      listed(4, { weight: 99 }),
      listed(5, { weight: 99 }),
    ]);
    // 4 was read before TVmaze changed it; 5 was read after its last change.
    await owner.query(`UPDATE drama SET detailed_at = '2026-10-01' WHERE id = 4`);
    await owner.query(`UPDATE drama SET detailed_at = '2026-11-15' WHERE id = 5`);

    expect(await store.nextToDetail(10)).toEqual([2, 3, 1, 4]);
    expect(await store.nextToDetail(2)).toEqual([2, 3]);
  });

  it('asks again for a drama once the index says TVmaze changed it', async () => {
    const store = createDramaRepository(prisma);
    await store.saveDetailed(untamedDetail);
    expect(await store.nextToDetail(10)).toEqual([]);

    await store.saveListed([{ ...untamed, sourceUpdatedAt: new Date(Date.now() + 60_000) }]);
    expect(await store.nextToDetail(10)).toEqual([42806]);
  });
});

describe('markChecked', () => {
  it('keeps a drama TVmaze no longer has and stops asking for it', async () => {
    const store = createDramaRepository(prisma);
    await store.saveListed([untamed]);
    await store.markChecked(42806);

    expect(await prisma.drama.count()).toBe(1);
    expect(await store.nextToDetail(10)).toEqual([]);
  });
});
