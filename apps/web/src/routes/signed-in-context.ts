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
  // One entry of a franchise saved as seen: the install suggestion waits for it (#44).
  onEntryMarkedSeen?: (() => void) | undefined;
  // counter_mode_changed also from Perfil's "Contar por" (#46).
  onCounterModeChanged?: ((event: { mode: CounterMode }) => void) | undefined;
  // Perfil (M16) signs out like the header button.
  onSignOut: () => void;
  signingOut: boolean;
  // When the Neon Auth session started: deleting the account asks for a fresh one (RF-06).
  sessionStartedAt?: string | undefined;
  onReauthenticate?: (() => void) | undefined;
  // After DELETE /api/v1/me succeeded (#38): App signs out and says the account is gone.
  onAccountDeleted?: (() => void) | undefined;
}

export const useSignedIn = () => useOutletContext<SignedInContext>();
