import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalyticsState } from '../analytics/AnalyticsContext';
import { useOwnProfile } from '../profile/use-own-profile';
import type { Profile } from '../profile-api';
import { useSignedIn } from '../routes/signed-in-context';

/**
 * Presentational with one effect: an AdSense unit (RF-58), only for a free user and only
 * while AdSense is configured. It never covers content: it reserves its height and says
 * "Publicidad". A Plus user, or a plan not known yet, gets nothing and loads nothing (RF-59).
 */
export function AdSlotView({ plan }: { plan: Profile['plan'] }) {
  const { ads } = useAnalyticsState();
  const { t } = useTranslation();
  const requested = useRef(false);
  const show = ads?.enabled === true && plan === 'free';

  useEffect(() => {
    // Once per mounted unit: StrictMode runs effects twice in development.
    if (!show || requested.current) return;
    requested.current = true;
    ads?.request();
  }, [show, ads]);

  if (!show) return null;
  return (
    <aside className="ad-slot" aria-label={t('ads.label')}>
      <span className="ad-slot__label" aria-hidden="true">
        {t('ads.label')}
      </span>
      <ins
        className="adsbygoogle ad-slot__unit"
        data-ad-client={ads?.client}
        data-ad-slot={ads?.slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}

/** Container: the slot of a signed-in screen, with the live plan (a purchase hides it). */
export function AdSlot() {
  const { profile: initial, getToken, fetchFn } = useSignedIn();
  const [profile] = useOwnProfile({ initial, getToken, fetchFn });
  return <AdSlotView plan={profile.plan} />;
}
