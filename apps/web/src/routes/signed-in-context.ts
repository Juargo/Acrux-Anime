import { useOutletContext } from 'react-router';
import type { AniListClient } from '../anilist/client';
import type { CounterMode } from '../counter/use-total-counter';

// What the signed-in layout (Home) hands to its screens; tests inject the AniList client and fetch.
export interface SignedInContext {
  getToken: () => Promise<string | null>;
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
  // The profile's counter mode, until the switch changes it (#34).
  counterMode: CounterMode;
}

export const useSignedIn = () => useOutletContext<SignedInContext>();
