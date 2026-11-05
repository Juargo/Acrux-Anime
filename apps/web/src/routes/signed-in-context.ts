import { useOutletContext } from 'react-router';
import type { AniListClient } from '../anilist/client';
import type { CardGeneratedEvent, CardSharedEvent } from '../card/CardScreen';
import type { FranchiseMarkedEvent } from '../catalog/use-franchise-marks';
import type { CounterMode } from '../counter/use-total-counter';
import type { ListMadePublicEvent } from '../profile/PrivacyScreen';
import type { Profile } from '../profile-api';

// What the signed-in layout (Home) hands to its screens; tests inject the AniList client and fetch.
export interface SignedInContext {
  getToken: () => Promise<string | null>;
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
  // The profile's counter mode, until the switch changes it (#34).
  counterMode: CounterMode;
  // The profile App loaded: who the card shows (#36), its handle and privacy (#37).
  profile: Profile;
  onCardGenerated?: ((event: CardGeneratedEvent) => void) | undefined;
  onCardShared?: ((event: CardSharedEvent) => void) | undefined;
  onListMadePublic?: ((event: ListMadePublicEvent) => void) | undefined;
  onFranchiseMarked?: ((event: FranchiseMarkedEvent) => void) | undefined;
  // Perfil (M16) signs out like the header button.
  onSignOut: () => void;
  signingOut: boolean;
}

export const useSignedIn = () => useOutletContext<SignedInContext>();
