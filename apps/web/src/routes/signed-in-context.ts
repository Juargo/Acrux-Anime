import { useOutletContext } from 'react-router';
import type { AniListClient } from '../anilist/client';
import type { CardGeneratedEvent, CardSharedEvent } from '../card/CardScreen';
import type { CounterMode } from '../counter/use-total-counter';
import type { Profile } from '../profile-api';

// What the signed-in layout (Home) hands to its screens; tests inject the AniList client and fetch.
export interface SignedInContext {
  getToken: () => Promise<string | null>;
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
  // The profile's counter mode, until the switch changes it (#34).
  counterMode: CounterMode;
  // Who the share card shows (#36).
  profile: Pick<Profile, 'displayName' | 'avatarUrl'>;
  onCardGenerated?: ((event: CardGeneratedEvent) => void) | undefined;
  onCardShared?: ((event: CardSharedEvent) => void) | undefined;
}

export const useSignedIn = () => useOutletContext<SignedInContext>();
