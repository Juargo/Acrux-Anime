import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Analytics, Consent } from './analytics';

interface AnalyticsState {
  analytics: Analytics | undefined;
  // The banner shows while the choice is open: undecided, or reopened from Perfil.
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
}

const AnalyticsContext = createContext<AnalyticsState>({
  analytics: undefined,
  preferencesOpen: false,
  openPreferences: () => {},
  closePreferences: () => {},
});

export function AnalyticsProvider(props: { analytics: Analytics; children: ReactNode }) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const value = useMemo(
    () => ({
      analytics: props.analytics,
      preferencesOpen,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
    }),
    [props.analytics, preferencesOpen],
  );
  return <AnalyticsContext.Provider value={value}>{props.children}</AnalyticsContext.Provider>;
}

export const useAnalyticsState = () => useContext(AnalyticsContext);

// The current choice, kept in sync with the banner and the Perfil row.
export function useConsent(): Consent | undefined {
  const { analytics } = useAnalyticsState();
  return useSyncExternalStore(
    (listener) => analytics?.subscribe(listener) ?? (() => {}),
    () => analytics?.consent(),
  );
}

const LABELS: Record<Consent, string> = {
  granted: 'Aceptada',
  denied: 'Rechazada',
  undecided: 'Sin decidir',
};

/** The "Analítica" row of Perfil (Figma M16, CUENTA Y PRIVACIDAD): reopens the banner. */
export function AnalyticsRow() {
  const { analytics, openPreferences } = useAnalyticsState();
  const consent = useConsent();
  if (!analytics?.enabled || !consent) return null;
  return (
    <button className="profile__row" type="button" onClick={openPreferences}>
      <span>Analítica</span>
      <span className="profile__value">{LABELS[consent]} ›</span>
    </button>
  );
}
