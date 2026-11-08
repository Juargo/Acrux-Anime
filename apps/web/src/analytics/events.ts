import type { CardGeneratedEvent, CardSharedEvent } from '../card/CardScreen';
import type { FranchiseMarkedEvent } from '../catalog/use-franchise-marks';
import type { CounterModeChangedEvent } from '../counter/TotalCounter';
import type { ListMadePublicEvent } from '../profile/PrivacyScreen';
import type { PublicProfileViewedEvent } from '../public-profile/PublicProfileScreen';
import type { Analytics } from './analytics';

// The app's event callbacks as the ADR-0030 events. Their payloads carry no personal data:
// modes, counts and sources only (S2 of odd/tasks/posthog.md).
export function eventCallbacks(analytics: Analytics) {
  return {
    onCounterModeChanged: (event: CounterModeChangedEvent) =>
      analytics.capture('counter_mode_changed', event),
    onCardGenerated: (event: CardGeneratedEvent) => analytics.capture('card_generated', event),
    onCardShared: (event: CardSharedEvent) => analytics.capture('card_shared', event),
    onListMadePublic: (event: ListMadePublicEvent) => analytics.capture('list_made_public', event),
    onFranchiseMarked: (event: FranchiseMarkedEvent) =>
      analytics.capture('franchise_marked', event),
    onViewed: (event: PublicProfileViewedEvent) =>
      analytics.capture('public_profile_viewed', event),
    onRateLimited: (event: { attempt: number }) => analytics.capture('anilist_rate_limited', event),
    // Plus (epic #50, RN-M4): no amount or order, only that it happened.
    onPlusCheckoutStarted: () => analytics.capture('plus_checkout_started', {}),
    onPlusPurchased: () => analytics.capture('plus_purchased', {}),
  };
}
