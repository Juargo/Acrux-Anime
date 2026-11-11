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
      // Nobody chose a language yet: the app follows the browser (#43).
      locale: null,
      listVisibility: 'private',
      counterMode: 'franchise',
      handle: 'camila',
      avatarPreset: null,
      shownTotal: null,
      shownMode: null,
      cardShared: false,
      badges: [],
      createdAt: expect.any(Date),
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

  it('saves the counter mode and keeps it on later sign-ins', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f74';
    const updated = await profiles.update(
      userId,
      { displayName: 'Camila', avatarUrl: null },
      { counterMode: 'entry' },
    );
    expect(updated.counterMode).toBe('entry');
    const again = await profiles.findOrCreate(userId, { displayName: 'Camila', avatarUrl: null });
    expect(again).toMatchObject({ displayName: 'Camila', counterMode: 'entry' });
    expect(await prisma.profile.count({ where: { userId } })).toBe(1);
  });

  it('saves the chosen language and goes back to the browser language with null (#43)', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f75';
    const initial = { displayName: 'Camila', avatarUrl: null };
    expect((await profiles.update(userId, initial, { locale: 'en' })).locale).toBe('en');
    expect((await profiles.findOrCreate(userId, initial)).locale).toBe('en');
    expect((await profiles.update(userId, initial, { counterMode: 'entry' })).locale).toBe('en');
    expect((await profiles.update(userId, initial, { locale: null })).locale).toBeNull();
  });

  it('gives the next profile with the same name the next free handle', async () => {
    const profiles = createProfileRepository(prisma);
    const first = await profiles.findOrCreate('7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f01', {
      displayName: 'José Núñez',
      avatarUrl: null,
    });
    const second = await profiles.findOrCreate('7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f02', {
      displayName: 'Jose Nunez',
      avatarUrl: null,
    });
    expect([first.handle, second.handle]).toEqual(['josenunez', 'josenunez2']);
  });

  it('keeps the handle on later sign-ins, even if Google changed the name', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f03';
    await profiles.findOrCreate(userId, { displayName: 'Rin', avatarUrl: null });
    const again = await profiles.findOrCreate(userId, {
      displayName: 'Rin Tohsaka',
      avatarUrl: null,
    });
    expect(again.handle).toBe('rin');
  });

  it('assigns a handle to a profile created before handles existed', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f04';
    await prisma.profile.create({ data: { userId, displayName: 'Mikasa' } });
    const profile = await profiles.findOrCreate(userId, {
      displayName: 'Ignored',
      avatarUrl: null,
    });
    expect(profile.handle).toBe('mikasa');
  });

  it('gives different handles to profiles with the same name created together', async () => {
    const profiles = createProfileRepository(prisma);
    const ids = Array.from(
      { length: 5 },
      (_, index) => `7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f1${index}`,
    );
    const created = await Promise.all(
      ids.map((userId) => profiles.findOrCreate(userId, { displayName: 'Levi', avatarUrl: null })),
    );
    expect(new Set(created.map((profile) => profile.handle)).size).toBe(5);
    expect(created.map((profile) => profile.handle).sort()).toEqual([
      'levi',
      'levi2',
      'levi3',
      'levi4',
      'levi5',
    ]);
  });

  it('saves the visibility, the shown counter and the first card shared', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f05';
    const initial = { displayName: 'Nami', avatarUrl: null };
    await profiles.update(userId, initial, {
      listVisibility: 'public',
      shown: { total: 48, mode: 'franchise' },
      cardShared: true,
    });
    const again = await profiles.findOrCreate(userId, initial);
    expect(again).toMatchObject({
      listVisibility: 'public',
      shownTotal: 48,
      shownMode: 'franchise',
      cardShared: true,
      counterMode: 'franchise',
    });
  });

  it('keeps the first card shared date when another card is shared', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f06';
    const initial = { displayName: 'Robin', avatarUrl: null };
    await profiles.update(userId, initial, { cardShared: true });
    const first = await prisma.profile.findUniqueOrThrow({ where: { userId } });
    await profiles.update(userId, initial, { cardShared: true });
    const second = await prisma.profile.findUniqueOrThrow({ where: { userId } });
    expect(second.cardSharedAt).toEqual(first.cardSharedAt);
  });

  it('finds a profile by its handle for visitors, and nothing for an unknown one', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f07';
    await profiles.update(
      userId,
      { displayName: 'Usopp', avatarUrl: 'https://lh3.googleusercontent.com/a/usopp' },
      { shown: { total: 12, mode: 'entry' } },
    );
    expect(await profiles.findByHandle('usopp')).toEqual({
      userId,
      handle: 'usopp',
      displayName: 'Usopp',
      avatarUrl: 'https://lh3.googleusercontent.com/a/usopp',
      avatarPreset: null,
      listVisibility: 'private',
      shownTotal: 12,
      shownMode: 'entry',
      badges: [],
    });
    expect(await profiles.findByHandle('nadie_aqui')).toBeNull();
  });

  it('keeps giving handles when the numbered ones of a name run out', async () => {
    const profiles = createProfileRepository(prisma);
    const handles: string[] = [];
    for (let index = 0; index < 60; index += 1) {
      const userId = `7a1c2a3e-8b7d-4c1e-9a2f-${String(900 + index).padStart(12, '0')}`;
      handles.push(
        (await profiles.findOrCreate(userId, { displayName: '李', avatarUrl: null })).handle,
      );
    }
    expect(new Set(handles).size).toBe(60);
    expect(handles.every((handle) => /^usuario\d*$/.test(handle))).toBe(true);
  }, 60_000);

  it('saves the display name and a preset avatar, and goes back to the Google one', async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f20';
    const initial = { displayName: 'Camila', avatarUrl: 'https://lh3.googleusercontent.com/a/c' };
    const before = await profiles.findOrCreate(userId, initial);

    const edited = await profiles.update(userId, initial, {
      displayName: 'Cami',
      avatarPreset: 'verde',
    });
    expect(edited).toMatchObject({
      displayName: 'Cami',
      avatarPreset: 'verde',
      avatarUrl: 'https://lh3.googleusercontent.com/a/c',
      handle: before.handle,
    });
    expect((await profiles.findByHandle(before.handle))?.displayName).toBe('Cami');

    const google = await profiles.update(userId, initial, { avatarPreset: null });
    expect(google.avatarPreset).toBeNull();

    // Badges start empty and are stored as the API validated them (RF-55).
    expect(google.badges).toEqual([]);
    const earned = await profiles.update(userId, initial, { badges: ['titles_10', 'genres_5'] });
    expect(earned.badges).toEqual(['titles_10', 'genres_5']);
    expect((await profiles.findByHandle(before.handle))?.badges).toEqual(['titles_10', 'genres_5']);

    // The Plus presets of RF-55 are stored as they are; the API decides who sees them.
    const plus = await profiles.update(userId, initial, { avatarPreset: 'eclipse' });
    expect(plus.avatarPreset).toBe('eclipse');
  });

  it("removes the profile with the user's marks, AniList link and plan, and nobody else's", async () => {
    const profiles = createProfileRepository(prisma);
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f30';
    const other = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f31';
    for (const [id, anilistUserId] of [
      [userId, 501],
      [other, 502],
    ] as const) {
      await profiles.findOrCreate(id, { displayName: 'Nami', avatarUrl: null });
      await prisma.mark.create({ data: { userId: id, animeId: 21, status: 'seen' } });
      await prisma.anilistLink.create({
        data: { userId: id, anilistUserId, accessTokenEncrypted: Buffer.from('x') },
      });
      await prisma.entitlement.create({ data: { userId: id, plan: 'plus_lifetime' } });
    }

    expect(await profiles.remove(userId)).toBe(true);

    expect(await prisma.profile.count({ where: { userId } })).toBe(0);
    expect(await prisma.mark.count({ where: { userId } })).toBe(0);
    expect(await prisma.anilistLink.count({ where: { userId } })).toBe(0);
    expect(await prisma.entitlement.count({ where: { userId } })).toBe(0);
    expect(await prisma.profile.count({ where: { userId: other } })).toBe(1);
    expect(await prisma.mark.count({ where: { userId: other } })).toBe(1);
    expect(await prisma.anilistLink.count({ where: { userId: other } })).toBe(1);
    expect(await prisma.entitlement.count({ where: { userId: other } })).toBe(1);
    // A retry finds nothing left to remove.
    expect(await profiles.remove(userId)).toBe(false);
  });

  it('refuses an unknown preset in the database itself', async () => {
    const userId = '7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f21';
    await prisma.profile.create({ data: { userId, displayName: 'Zoro' } });
    await expect(
      prisma.$executeRaw`UPDATE "profile" SET "avatar_preset" = 'rosa' WHERE "user_id" = ${userId}::uuid`,
    ).rejects.toThrow();
  });
});
