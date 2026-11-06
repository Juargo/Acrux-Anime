import type { Session } from '../../../http/session.js';
import type { MarksService, MarkView } from '../../marks/services/marks.service.js';
import type { MeView, ProfileService } from '../../profile/services/profile.service.js';
import type { AuthDirectory } from '../adapters/neon-auth-admin.js';
import type { AnalyticsPersons } from '../adapters/posthog-persons.js';

// Everything Acrux keeps about the user (ADR-0028), without internal ids.
export interface AccountExport {
  exportedAt: Date;
  profile: Omit<MeView, 'analyticsId'>;
  marks: MarkView[];
}

// The Neon Auth user could not be deleted after the data was: a retry finishes the job.
export class AuthDeletionError extends Error {
  constructor(cause: unknown) {
    super('The Neon Auth user could not be deleted', { cause });
    this.name = 'AuthDeletionError';
  }
}

export interface AccountService {
  // False without the Neon credentials: nothing is deleted then, not even the data.
  readonly canDelete: boolean;
  exportData(session: Session): Promise<AccountExport>;
  // The data in one transaction, then the Neon Auth user, then the PostHog person (RDI-35).
  // Idempotent. A PostHog failure does not undo anything; it comes back to be reported.
  deleteAccount(session: Session): Promise<{ analyticsError?: unknown }>;
}

const EXPORT_PAGE = 500;

export function createAccountService(options: {
  profiles: Pick<ProfileService, 'me' | 'remove'>;
  marks: Pick<MarksService, 'listOf'>;
  directory?: AuthDirectory | undefined;
  persons?: AnalyticsPersons | undefined;
  // The salted id PostHog knows the user by; null when analytics is off.
  analyticsIdOf?: ((userId: string) => string | null) | undefined;
  now?: () => Date;
}): AccountService {
  const { profiles, marks, directory, persons, analyticsIdOf } = options;
  const now = options.now ?? (() => new Date());

  async function allMarks(userId: string): Promise<MarkView[]> {
    const items: MarkView[] = [];
    let after: number | undefined;
    do {
      const page = await marks.listOf(userId, { after, limit: EXPORT_PAGE });
      items.push(...page.items);
      after = page.nextCursor ?? undefined;
    } while (after !== undefined);
    return items;
  }

  return {
    canDelete: directory !== undefined,
    exportData: async (session) => {
      const { analyticsId: _analyticsId, ...profile } = await profiles.me(session);
      return { exportedAt: now(), profile, marks: await allMarks(session.userId) };
    },
    deleteAccount: async (session) => {
      if (!directory) throw new Error('Account deletion is not configured');
      await profiles.remove(session.userId);
      try {
        await directory.deleteUser(session.userId);
      } catch (error) {
        throw new AuthDeletionError(error);
      }
      const distinctId = analyticsIdOf?.(session.userId) ?? null;
      if (!persons || !distinctId) return {};
      try {
        await persons.deletePerson(distinctId);
        return {};
      } catch (error) {
        return { analyticsError: error };
      }
    },
  };
}
