import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { handleBase, handleCandidates, randomCandidate } from '../domain/handle.js';

type CounterMode = 'franchise' | 'entry';
type ListVisibility = 'private' | 'public';

export interface ProfileView {
  displayName: string;
  avatarUrl: string | null;
  locale: string;
  listVisibility: ListVisibility;
  counterMode: CounterMode;
  // The @handle of the public link (#37).
  handle: string;
  // The owner's last counter, shown to visitors and in the preview image (#37).
  shownTotal: number | null;
  shownMode: CounterMode | null;
  // Whether a card was ever shared (#36): the first share offers to make the list public.
  cardShared: boolean;
}

// What a visitor may read of someone else's profile; the list stays behind listVisibility.
export interface PublicProfileRow {
  userId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  listVisibility: ListVisibility;
  shownTotal: number | null;
  shownMode: CounterMode | null;
}

export interface ProfileChanges {
  counterMode?: CounterMode | undefined;
  listVisibility?: ListVisibility | undefined;
  shown?: { total: number; mode: CounterMode } | undefined;
  // Only true: the date of the first card shared is kept.
  cardShared?: true | undefined;
}

const SELECT = {
  displayName: true,
  avatarUrl: true,
  locale: true,
  listVisibility: true,
  counterMode: true,
  handle: true,
  shownTotal: true,
  shownMode: true,
  cardSharedAt: true,
} as const;

type Row = Prisma.ProfileGetPayload<{ select: typeof SELECT }>;

const view = ({ cardSharedAt, handle, ...row }: Row, assigned: string): ProfileView => ({
  ...row,
  handle: handle ?? assigned,
  cardShared: cardSharedAt !== null,
});

// Candidates checked at once, and attempts when a concurrent request takes the chosen one.
const BATCH = 50;
const ATTEMPTS = 8;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export interface ProfileRepository {
  // Creates the profile once, with the schema defaults (private list, franchise
  // counter), and never overwrites one that exists. A profile without a handle gets one.
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
  // The public profile of a handle (RF-40), or null when no profile has it.
  findByHandle(handle: string): Promise<PublicProfileRow | null>;
}

export function createProfileRepository(prisma: PrismaClient): ProfileRepository {
  // ON CONFLICT DO NOTHING: concurrent first requests create a single row.
  const create = (userId: string, initial: { displayName: string; avatarUrl: string | null }) =>
    prisma.profile.createMany({ data: [{ userId, ...initial }], skipDuplicates: true });

  // The first free candidate of the display name; the unique index settles races, so a
  // clash only means trying again with the handles taken by then. Once the numbered
  // candidates are all taken, random ones are tried instead.
  async function assignHandle(userId: string, displayName: string): Promise<string> {
    const base = handleBase(displayName);
    let candidates = handleCandidates(base, BATCH);
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const taken = new Set(
        (
          await prisma.profile.findMany({
            where: { handle: { in: candidates } },
            select: { handle: true },
          })
        ).map((row) => row.handle),
      );
      const free = candidates.find((candidate) => !taken.has(candidate));
      if (!free) {
        candidates = Array.from({ length: BATCH }, () => randomCandidate(base));
        continue;
      }
      try {
        await prisma.profile.updateMany({
          where: { userId, handle: null },
          data: { handle: free },
        });
      } catch (error) {
        if (isUniqueViolation(error)) continue;
        throw error;
      }
      const row = await prisma.profile.findUniqueOrThrow({
        where: { userId },
        select: { handle: true },
      });
      if (row.handle) return row.handle;
    }
    throw new Error('No free handle for the profile');
  }

  async function read(userId: string): Promise<ProfileView> {
    const row = await prisma.profile.findUniqueOrThrow({ where: { userId }, select: SELECT });
    return view(row, row.handle ?? (await assignHandle(userId, row.displayName)));
  }

  return {
    findOrCreate: async (userId, initial) => {
      await create(userId, initial);
      return read(userId);
    },
    update: async (userId, initial, changes) => {
      await create(userId, initial);
      const { counterMode, listVisibility, shown, cardShared } = changes;
      await prisma.profile.update({
        where: { userId },
        data: {
          ...(counterMode && { counterMode }),
          ...(listVisibility && { listVisibility }),
          ...(shown && { shownTotal: shown.total, shownMode: shown.mode }),
        },
      });
      if (cardShared) {
        await prisma.profile.updateMany({
          where: { userId, cardSharedAt: null },
          data: { cardSharedAt: new Date() },
        });
      }
      return read(userId);
    },
    findByHandle: (handle) =>
      prisma.profile
        .findUnique({
          where: { handle },
          select: {
            userId: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            listVisibility: true,
            shownTotal: true,
            shownMode: true,
          },
        })
        .then((row) => (row?.handle ? { ...row, handle: row.handle } : null)),
  };
}
