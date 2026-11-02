import type { PrismaClient } from '../../../generated/prisma/client.js';

export interface ProfileView {
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  listVisibility: 'private' | 'public';
  counterMode: 'franchise' | 'entry';
}

export interface ProfileRepository {
  // Creates the profile once, with the schema defaults (private list, franchise
  // counter), and never overwrites one that exists.
  findOrCreate(
    userId: string,
    initial: { displayName: string; avatarUrl: string | null },
  ): Promise<ProfileView>;
}

export function createProfileRepository(prisma: PrismaClient): ProfileRepository {
  return {
    findOrCreate: async (userId, initial) => {
      // ON CONFLICT DO NOTHING: concurrent first requests create a single row.
      await prisma.profile.createMany({ data: [{ userId, ...initial }], skipDuplicates: true });
      return prisma.profile.findUniqueOrThrow({
        where: { userId },
        select: {
          displayName: true,
          avatarUrl: true,
          locale: true,
          listVisibility: true,
          counterMode: true,
        },
      });
    },
  };
}
