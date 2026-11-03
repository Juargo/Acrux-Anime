import type { PrismaClient } from '../../../generated/prisma/client.js';

export interface ProfileView {
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  listVisibility: 'private' | 'public';
  counterMode: 'franchise' | 'entry';
}

export interface ProfileChanges {
  counterMode: 'franchise' | 'entry';
}

const VIEW = {
  displayName: true,
  avatarUrl: true,
  locale: true,
  listVisibility: true,
  counterMode: true,
} as const;

export interface ProfileRepository {
  // Creates the profile once, with the schema defaults (private list, franchise
  // counter), and never overwrites one that exists.
  findOrCreate(
    userId: string,
    initial: { displayName: string; avatarUrl: string | null },
  ): Promise<ProfileView>;
  // Creates the profile first if needed, as findOrCreate does, then applies the changes.
  update(
    userId: string,
    initial: { displayName: string; avatarUrl: string | null },
    changes: ProfileChanges,
  ): Promise<ProfileView>;
}

export function createProfileRepository(prisma: PrismaClient): ProfileRepository {
  // ON CONFLICT DO NOTHING: concurrent first requests create a single row.
  const create = (userId: string, initial: { displayName: string; avatarUrl: string | null }) =>
    prisma.profile.createMany({ data: [{ userId, ...initial }], skipDuplicates: true });
  return {
    findOrCreate: async (userId, initial) => {
      await create(userId, initial);
      return prisma.profile.findUniqueOrThrow({ where: { userId }, select: VIEW });
    },
    update: async (userId, initial, changes) => {
      await create(userId, initial);
      return prisma.profile.update({ where: { userId }, data: changes, select: VIEW });
    },
  };
}
