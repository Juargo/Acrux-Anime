import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalyticsState, useConsent } from './AnalyticsContext';

// The landing's privacy policy (the app's /privacidad is who sees your list, #37).
export const PRIVACY_POLICY_URL = 'https://acruxanime.com/privacidad';

/**
 * The consent notice of the landing (Figma 72:351) in the web app (#46, ADR-0028): PostHog
 * loads only after "Aceptar", both choices weigh the same, and Perfil reopens it.
 */
export function ConsentBanner() {
  const { analytics, preferencesOpen, closePreferences } = useAnalyticsState();
  const consent = useConsent();
  const titleId = useId();
  const { t } = useTranslation();
  if (!analytics?.enabled || (consent !== 'undecided' && !preferencesOpen)) return null;

  function choose(granted: boolean) {
    if (granted) analytics?.grant();
    else analytics?.deny();
    closePreferences();
  }

  return (
    <section className="consent" aria-labelledby={titleId}>
      <p className="consent__title" id={titleId}>
        {t('analytics.bannerTitle')}
      </p>
      <p className="consent__text">{t('analytics.bannerText')}</p>
      <div className="consent__actions">
        <a className="consent__more" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
          {t('analytics.more')}
        </a>
        <div className="consent__buttons">
          <button className="consent__button" type="button" onClick={() => choose(false)}>
            {t('analytics.deny')}
          </button>
          <button className="consent__button" type="button" onClick={() => choose(true)}>
            {t('analytics.grant')}
          </button>
        </div>
      </div>
    </section>
  );
}
