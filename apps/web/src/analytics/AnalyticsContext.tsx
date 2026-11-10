import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Ads } from '../ads/ads';
import type { Analytics, Consent } from './analytics';

interface AnalyticsState {
  analytics: Analytics | undefined;
  // AdSense (RF-58); its consent is asked next to analytics, each on its own.
  ads: Ads | undefined;
  // The banner shows while the choice is open: undecided, or reopened from Perfil.
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
}

const AnalyticsContext = createContext<AnalyticsState>({
  analytics: undefined,
  ads: undefined,
  preferencesOpen: false,
  openPreferences: () => {},
  closePreferences: () => {},
});

export function AnalyticsProvider(props: {
  analytics: Analytics;
  ads?: Ads | undefined;
  children: ReactNode;
}) {
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const value = useMemo(
    () => ({
      analytics: props.analytics,
      ads: props.ads,
      preferencesOpen,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
    }),
    [props.analytics, props.ads, preferencesOpen],
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

// The personalized-ads choice (RF-58), kept in sync with the banner and its Perfil row.
export function useAdsConsent(): Consent | undefined {
  const { ads } = useAnalyticsState();
  return useSyncExternalStore(
    (listener) => ads?.subscribe(listener) ?? (() => {}),
    () => (ads?.enabled ? ads.consent() : undefined),
  );
}

/** The "Analítica" row of Perfil (Figma M16, CUENTA Y PRIVACIDAD): reopens the banner. */
export function AnalyticsRow() {
  const { analytics, openPreferences } = useAnalyticsState();
  const consent = useConsent();
  const { t } = useTranslation();
  if (!analytics?.enabled || !consent) return null;
  return (
    <button className="profile__row" type="button" onClick={openPreferences}>
      <span>{t('analytics.row')}</span>
      <span className="profile__value">{t(`analytics.consent.${consent}`)} ›</span>
    </button>
  );
}

/** The "Anuncios personalizados" row of Perfil (RF-58): reopens the banner, only with AdSense. */
export function AdsRow() {
  const { openPreferences } = useAnalyticsState();
  const consent = useAdsConsent();
  const { t } = useTranslation();
  if (!consent) return null;
  return (
    <button className="profile__row" type="button" onClick={openPreferences}>
      <span>{t('ads.row')}</span>
      <span className="profile__value">{t(`ads.consent.${consent}`)} ›</span>
    </button>
  );
}
