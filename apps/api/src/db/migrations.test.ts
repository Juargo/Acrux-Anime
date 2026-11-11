import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  'anime',
  'mark_anilist',
  'franchise_override_anilist',
];
const USER_ID = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const backupUserId = '8c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const apiDir = fileURLToPath(new URL('../..', import.meta.url));

let container: StartedPostgreSqlContainer;
let owner: pg.Client;
let backupStartsWithLogin: boolean | undefined;

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
  const { rows } = await owner.query<{ rolcanlogin: boolean }>(
    `SELECT rolcanlogin FROM pg_roles WHERE rolname = 'acrux_backup'`,
  );
  backupStartsWithLogin = rows[0]?.rolcanlogin;
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
  it('creates the nine application tables', async () => {
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

  it('offers only the lifetime plan (ADR-0036)', async () => {
    const { rows } = await owner.query<{ value: string }>(
      `SELECT unnest(enum_range(NULL::plan))::text AS value`,
    );
    expect(rows.map((row) => row.value)).toEqual(['plus_lifetime']);
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
    await owner.query(`INSERT INTO mark (user_id, anime_id, status) VALUES ($1, 21, 'seen')`, [
      USER_ID,
    ]);
    const code = await sqlState(
      owner.query(`INSERT INTO mark (user_id, anime_id, status) VALUES ($1, 21, 'watching')`, [
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
    await api.query(`INSERT INTO mark (user_id, anime_id, status) VALUES ($1, 1535, 'watching')`, [
      otherUserId,
    ]);
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

describe('the acrux_backup role', () => {
  let backup: pg.Client;

  beforeAll(async () => {
    // Outside the repo, production gives acrux_backup a login and a secret password.
    await owner.query(`ALTER ROLE acrux_backup WITH LOGIN PASSWORD 'backup-test'`);
    backup = await connectAs('acrux_backup', 'backup-test');
  });

  afterAll(async () => {
    await backup?.end();
  });

  it('starts without login after the migrations', () => {
    expect(backupStartsWithLogin).toBe(false);
  });

  it.each([...APP_TABLES, '_prisma_migrations'])('reads %s despite RLS', async (table) => {
    expect(await sqlState(backup.query(`SELECT * FROM ${table}`))).toBeUndefined();
  });

  it('sees rows that RLS hides from a role without a policy', async () => {
    await owner.query(`INSERT INTO profile (user_id, display_name) VALUES ($1, 'Lucía')`, [
      backupUserId,
    ]);
    const { rows } = await backup.query('SELECT display_name FROM profile WHERE user_id = $1', [
      backupUserId,
    ]);
    expect(rows).toEqual([{ display_name: 'Lucía' }]);
  });

  it('cannot write rows or change the schema', async () => {
    expect(
      await sqlState(
        backup.query(`INSERT INTO profile (user_id, display_name) VALUES ($1, 'x')`, [
          '00000000-0000-4000-8000-000000000002',
        ]),
      ),
    ).toBe('42501');
    expect(await sqlState(backup.query('DELETE FROM mark'))).toBe('42501');
    expect(await sqlState(backup.query('CREATE TABLE intruder (id int)'))).toBe('42501');
    expect(await sqlState(backup.query('DROP TABLE mark'))).toBe('42501');
  });

  it('dumps the schema and the data of every table', async () => {
    const { exitCode, stdout } = await container.exec(
      [
        'pg_dump',
        '--host=localhost',
        '--username=acrux_backup',
        `--dbname=${container.getDatabase()}`,
      ],
      { env: { PGPASSWORD: 'backup-test' } },
    );
    expect(exitCode).toBe(0);
    for (const table of [...APP_TABLES, '_prisma_migrations']) {
      expect(stdout).toContain(`COPY public.${table}`);
    }
  });
});

// ADR-0043, point 6: the stored ids become MyAnimeList ids. Runs the migration files one
// by one on a second database, with rows written before the conversion.
describe('the conversion to MyAnimeList ids', () => {
  const CONVERSION = '20261110020000_ids_de_myanimelist';
  const OTHER_USER = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  let db: pg.Client;

  beforeAll(async () => {
    await owner.query('CREATE DATABASE conversion');
    const url = new URL(container.getConnectionUri());
    url.pathname = '/conversion';
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();

    const migrationsDir = join(apiDir, 'prisma', 'migrations');
    const names = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const sqlOf = (name: string) =>
      readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8');
    expect(names).toContain(CONVERSION);
    // Prisma creates its history table before the first migration, which enables RLS on it.
    await db.query('CREATE TABLE _prisma_migrations (id VARCHAR(36) PRIMARY KEY)');
    for (const name of names.filter((candidate) => candidate < CONVERSION)) {
      await db.query(sqlOf(name));
    }

    await db.query(
      `INSERT INTO profile (user_id, display_name) VALUES ($1, 'Camila'), ($2, 'Nami')`,
      [USER_ID, OTHER_USER],
    );
    await db.query(
      `INSERT INTO mark (user_id, anime_id, mal_id, status, marked_at) VALUES
        ($1, 16498, 16498, 'seen', '2026-11-01T10:00:00Z'),
        -- Its MyAnimeList id is the AniList id of the row below: the ids cross.
        ($1, 5114, 121, 'watching', '2026-11-02T10:00:00Z'),
        ($1, 121, 5114, 'seen', '2026-11-03T10:00:00Z'),
        -- Two AniList entries of one MyAnimeList anime: the seen one stays.
        ($1, 300, 77, 'watching', '2026-11-04T10:00:00Z'),
        ($1, 301, 77, 'seen', '2026-11-05T10:00:00Z'),
        -- AniList never told its MyAnimeList id.
        ($1, 999, NULL, 'seen', '2026-11-06T10:00:00Z'),
        ($2, 16498, 16498, 'watching', '2026-11-07T10:00:00Z')`,
      [USER_ID, OTHER_USER],
    );
    await db.query(
      `INSERT INTO franchise_override (anime_id, franchise_root_id, role, updated_at)
        VALUES (20811, 16498, 'extra', '2026-11-01T10:00:00Z')`,
    );

    await db.query(sqlOf(CONVERSION));
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  it('keys every convertible mark by its MyAnimeList id, with its status and date', async () => {
    const { rows } = await db.query(
      `SELECT user_id, anime_id, status::text, marked_at FROM mark ORDER BY user_id, anime_id`,
    );
    expect(rows).toEqual([
      {
        user_id: USER_ID,
        anime_id: 77,
        status: 'seen',
        marked_at: new Date('2026-11-05T10:00:00Z'),
      },
      {
        user_id: USER_ID,
        anime_id: 121,
        status: 'watching',
        marked_at: new Date('2026-11-02T10:00:00Z'),
      },
      {
        user_id: USER_ID,
        anime_id: 5114,
        status: 'seen',
        marked_at: new Date('2026-11-03T10:00:00Z'),
      },
      {
        user_id: USER_ID,
        anime_id: 16498,
        status: 'seen',
        marked_at: new Date('2026-11-01T10:00:00Z'),
      },
      {
        user_id: OTHER_USER,
        anime_id: 16498,
        status: 'watching',
        marked_at: new Date('2026-11-07T10:00:00Z'),
      },
    ]);
  });

  it('drops the mal_id column and keeps one mark per user and anime', async () => {
    const { rows } = await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'mark' ORDER BY column_name`,
    );
    expect(rows.map((row) => row.column_name)).toEqual([
      'anime_id',
      'marked_at',
      'status',
      'user_id',
    ]);
    expect(
      await sqlState(
        db.query(`INSERT INTO mark (user_id, anime_id, status) VALUES ($1, 77, 'watching')`, [
          USER_ID,
        ]),
      ),
    ).toBe('23505');
  });

  it('keeps aside, with the reason, every mark it could not convert', async () => {
    const { rows } = await db.query(
      `SELECT anilist_id, mal_id, status::text, marked_at, reason
        FROM mark_anilist WHERE user_id = $1 ORDER BY anilist_id`,
      [USER_ID],
    );
    expect(rows).toEqual([
      {
        anilist_id: 300,
        mal_id: 77,
        status: 'watching',
        marked_at: new Date('2026-11-04T10:00:00Z'),
        reason: 'duplicate',
      },
      {
        anilist_id: 999,
        mal_id: null,
        status: 'seen',
        marked_at: new Date('2026-11-06T10:00:00Z'),
        reason: 'no_mal_id',
      },
    ]);
  });

  it('keeps aside the curator table, which holds no MyAnimeList ids, and empties it', async () => {
    const kept = await db.query(
      `SELECT anilist_id, franchise_root_id, role::text, updated_at FROM franchise_override_anilist`,
    );
    expect(kept.rows).toEqual([
      {
        anilist_id: 20811,
        franchise_root_id: 16498,
        role: 'extra',
        updated_at: new Date('2026-11-01T10:00:00Z'),
      },
    ]);
    expect((await db.query('SELECT 1 FROM franchise_override')).rowCount).toBe(0);
  });

  it('deletes the marks kept aside when the account is deleted', async () => {
    await db.query('DELETE FROM profile WHERE user_id = $1', [USER_ID]);
    expect((await db.query('SELECT 1 FROM mark_anilist')).rowCount).toBe(0);
  });
});
