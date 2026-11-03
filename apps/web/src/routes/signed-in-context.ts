import { useOutletContext } from 'react-router';
import type { AniListClient } from '../anilist/client';

// What the signed-in layout (Home) hands to its screens; tests inject the AniList client and fetch.
export interface SignedInContext {
  getToken: () => Promise<string | null>;
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
}

export const useSignedIn = () => useOutletContext<SignedInContext>();
