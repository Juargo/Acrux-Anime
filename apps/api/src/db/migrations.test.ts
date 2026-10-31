import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Applies the real Prisma migrations to an empty Postgres 17 and checks the database
// rules of ADR-0022 and ADR-0028 as each role sees them.

const APP_TABLES = [
  'profile',
  'mark',
  'anilist_link',
  'entitlement',
  'billing_event',
  'franchise_override',
];
const USER_ID = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const apiDir = fileURLToPath(new URL('../..', import.meta.url));

let container: StartedPostgreSqlContainer;
let owner: pg.Client;

function urlFor(user: string, password: string): string {
  const url = new URL(container.getConnectionUri());
  url.username = user;
  url.password = password;
  return url.toString();
}

async function connectAs(user: string, password: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: urlFor(user, password) });
  await client.connect();
  return client;
}

async function sqlState(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    env: { ...process.env, DATABASE_URL_UNPOOLED: container.getConnectionUri() },
    stdio: 'pipe',
  });
  owner = new pg.Client({ connectionString: container.getConnectionUri() });
  await owner.connect();
  // Outside the repo, each Neon branch gives acrux_api a login and a secret password.
  await owner.query(`ALTER ROLE acrux_api WITH LOGIN PASSWORD 'api-test'`);
  // Stands for any other role, such as the ones the Neon Data API would use.
  await owner.query(`CREATE ROLE outsider WITH LOGIN PASSWORD 'outsider-test'`);
}, 180_000);

afterAll(async () => {
  await owner?.end();
  await container?.stop();
});

describe('initial schema', () => {
  it('creates the six application tables', async () => {
    const { rows } = await owner.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'`,
    );
    expect(rows.map((row) => row.table_name).sort()).toEqual([...APP_TABLES].sort());
  });

  it('enables RLS on every table of public', async () => {
    const { rows } = await owner.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(APP_TABLES.length);
    expect(rows.filter((row) => !row.relrowsecurity)).toEqual([]);
  });

  it('creates profiles with a private list by default', async () => {
    await owner.query(`INSERT INTO profile (user_id, display_name) VALUES ($1, 'Camila')`, [
      USER_ID,
    ]);
    const { rows } = await owner.query(
      'SELECT list_visibility, counter_mode FROM profile WHERE user_id = $1',
      [USER_ID],
    );
    expect(rows[0]).toEqual({ list_visibility: 'private', counter_mode: 'franchise' });
  });

  it('rejects a duplicate mark for the same user and anime', async () => {
    await owner.query(`INSERT INTO mark (user_id, anilist_id, status) VALUES ($1, 21, 'seen')`, [
      USER_ID,
    ]);
    const code = await sqlState(
      owner.query(`INSERT INTO mark (user_id, anilist_id, status) VALUES ($1, 21, 'watching')`, [
        USER_ID,
      ]),
    );
    expect(code).toBe('23505');
  });
});

describe('a role without grants', () => {
  let outsider: pg.Client;

  beforeAll(async () => {
    outsider = await connectAs('outsider', 'outsider-test');
  });

  afterAll(async () => {
    await outsider?.end();
  });

  it.each(APP_TABLES)('cannot read %s', async (table) => {
    expect(await sqlState(outsider.query(`SELECT * FROM ${table}`))).toBe('42501');
  });

  it('cannot write a profile or a mark', async () => {
    expect(
      await sqlState(
        outsider.query(`INSERT INTO profile (user_id, display_name) VALUES ($1, 'x')`, [
          '00000000-0000-4000-8000-000000000001',
        ]),
      ),
    ).toBe('42501');
    expect(await sqlState(outsider.query('DELETE FROM mark'))).toBe('42501');
  });
});

describe('the acrux_api role', () => {
  let api: pg.Client;
  const otherUserId = '7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';

  beforeAll(async () => {
    api = await connectAs('acrux_api', 'api-test');
  });

  afterAll(async () => {
    await api?.end();
  });

  it('reads, writes, updates and deletes application rows despite RLS', async () => {
    await api.query(`INSERT INTO profile (user_id, display_name) VALUES ($1, 'Mateo')`, [
      otherUserId,
    ]);
    await api.query(
      `INSERT INTO mark (user_id, anilist_id, status) VALUES ($1, 1535, 'watching')`,
      [otherUserId],
    );
    await api.query(`UPDATE mark SET status = 'seen' WHERE user_id = $1`, [otherUserId]);
    const { rows } = await api.query('SELECT status FROM mark WHERE user_id = $1', [otherUserId]);
    expect(rows).toEqual([{ status: 'seen' }]);

    await api.query('DELETE FROM profile WHERE user_id = $1', [otherUserId]);
    const remaining = await api.query('SELECT 1 FROM mark WHERE user_id = $1', [otherUserId]);
    expect(remaining.rowCount).toBe(0);
  });

  it('cannot change the schema', async () => {
    expect(await sqlState(api.query('CREATE TABLE intruder (id int)'))).toBe('42501');
    expect(await sqlState(api.query('ALTER TABLE mark ADD COLUMN extra int'))).toBe('42501');
    expect(await sqlState(api.query('DROP TABLE mark'))).toBe('42501');
  });

  it('cannot read the migration history', async () => {
    expect(await sqlState(api.query('SELECT * FROM _prisma_migrations'))).toBe('42501');
  });
});
