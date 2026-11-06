import type { Analytics } from './analytics/analytics';

// After DELETE /api/v1/me (#38). The API asked PostHog to delete the person, so the app
// forgets it first and sends account_deleted anonymously: the event counts deletions without
// bringing the person back (ADR-0030). Signing out can fail because the Neon Auth user is
// already gone; the local session is dropped either way.
export async function finishAccountDeletion(options: {
  analytics: Analytics | undefined;
  signOut: () => Promise<unknown>;
}): Promise<void> {
  options.analytics?.forget();
  options.analytics?.capture('account_deleted');
  try {
    await options.signOut();
  } catch {
    // Nothing left to sign out of.
  }
}
