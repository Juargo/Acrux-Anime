import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdsConsent, useAnalyticsState, useConsent } from './AnalyticsContext';

// The landing's privacy policy (the app's /privacidad is who sees your list, #37).
export const PRIVACY_POLICY_URL = 'https://acruxanime.com/privacidad';

/**
 * The consent notice of the landing (Figma 72:351) in the web app (#46, ADR-0028): PostHog
 * loads only after "Aceptar", both choices weigh the same, and Perfil reopens it.
 */
export function ConsentBanner() {
  const { analytics, ads, preferencesOpen, closePreferences } = useAnalyticsState();
  const consent = useConsent();
  const adsConsent = useAdsConsent();
  const titleId = useId();
  const { t } = useTranslation();
  if (ads?.enabled && adsConsent) {
    const undecided =
      adsConsent === 'undecided' || (analytics?.enabled === true && consent === 'undecided');
    if (!undecided && !preferencesOpen) return null;
    return <PrivacyChoices analyticsConsent={analytics?.enabled ? consent : undefined} />;
  }
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

/**
 * With AdSense (RF-58, S3 of odd/tasks/anuncios.md): analytics and personalized ads are asked
 * separately. Both start unchecked, and "Rechazar todo" weighs the same as "Aceptar todo".
 */
function PrivacyChoices({ analyticsConsent }: { analyticsConsent: string | undefined }) {
  const { analytics, ads, closePreferences } = useAnalyticsState();
  const titleId = useId();
  const { t } = useTranslation();
  const [measure, setMeasure] = useState(analyticsConsent === 'granted');
  const [personalize, setPersonalize] = useState(ads?.consent() === 'granted');

  function save(nextMeasure: boolean, nextPersonalize: boolean) {
    if (analyticsConsent !== undefined) {
      if (nextMeasure) analytics?.grant();
      else analytics?.deny();
    }
    if (nextPersonalize) ads?.grant();
    else ads?.deny();
    closePreferences();
  }

  return (
    <section className="consent" aria-labelledby={titleId}>
      <p className="consent__title" id={titleId}>
        {t('ads.bannerTitle')}
      </p>
      <p className="consent__text">{t('ads.bannerText')}</p>
      {analyticsConsent !== undefined && (
        <Choice
          name={t('analytics.row')}
          hint={t('ads.analyticsHint')}
          checked={measure}
          onChange={setMeasure}
        />
      )}
      <Choice
        name={t('ads.row')}
        hint={t('ads.personalizeHint')}
        checked={personalize}
        onChange={setPersonalize}
      />
      <div className="consent__actions">
        <a className="consent__more" href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
          {t('analytics.more')}
        </a>
        <div className="consent__buttons">
          <button className="consent__button" type="button" onClick={() => save(false, false)}>
            {t('ads.denyAll')}
          </button>
          <button
            className="consent__button"
            type="button"
            onClick={() => save(measure, personalize)}
          >
            {t('ads.save')}
          </button>
          <button className="consent__button" type="button" onClick={() => save(true, true)}>
            {t('ads.grantAll')}
          </button>
        </div>
      </div>
    </section>
  );
}

function Choice(props: {
  name: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const nameId = useId();
  const hintId = useId();
  return (
    <label className="consent__choice">
      <input
        type="checkbox"
        aria-labelledby={nameId}
        aria-describedby={hintId}
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      <span>
        <span className="consent__choice-name" id={nameId}>
          {props.name}
        </span>
        <span className="consent__choice-hint" id={hintId}>
          {props.hint}
        </span>
      </span>
    </label>
  );
}
