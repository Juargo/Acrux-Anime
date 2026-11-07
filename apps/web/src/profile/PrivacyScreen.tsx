import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { errorCode, errorMessage } from '../api-errors';
import type { Profile } from '../profile-api';
import { useOwnProfile } from './use-own-profile';

// ADR-0030: no personal data; where the list was made public.
export type ListMadePublicEvent = { source: 'privacy' | 'first_share' };

type Visibility = Profile['listVisibility'];

const OPTIONS: Visibility[] = ['private', 'public'];

/** Presentational: "ASÍ TE VE UN VISITANTE" of Figma M17. */
function VisitorPreview({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const name = profile.displayName.trim() || t('privacy.yourProfile');
  return (
    <section className="privacy__preview" aria-label={t('privacy.visitor')}>
      <h2 className="privacy__label">{t('privacy.visitor')}</h2>
      <div className="privacy__card">
        {profile.shownTotal !== null && (
          <p className="public-profile__total">
            <span className="public-profile__count">{profile.shownTotal}</span>
            <span className="public-profile__label">
              {t(profile.shownMode === 'entry' ? 'app.total.entry' : 'app.total.franchise')}
            </span>
          </p>
        )}
        {profile.listVisibility === 'private' ? (
          <p className="privacy__note">
            <span aria-hidden="true">🔒 </span>
            {t('app.privateList', { name })}
          </p>
        ) : (
          <p className="privacy__note">{t('privacy.publicNote')}</p>
        )}
      </div>
      <Link className="privacy__link" to={`/@${profile.handle}`}>
        {t('privacy.seePublicProfile')}
      </Link>
    </section>
  );
}

/**
 * Container: "Privacidad de tu lista" (RF-42, Figma M17). The choice changes at once, is saved
 * in the profile and goes back if saving fails (RNF-11); the API hides a private list at once.
 */
export function PrivacyScreen({
  profile: initial,
  getToken,
  fetchFn,
  onListMadePublic,
}: {
  profile: Profile;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  onListMadePublic?: ((event: ListMadePublicEvent) => void) | undefined;
}) {
  const [profile, save] = useOwnProfile({ initial, getToken, fetchFn });
  const [pending, setPending] = useState<Visibility | null>(null);
  const { t } = useTranslation();
  const [status, setStatus] = useState<'saved' | { failed: string | undefined } | null>(null);
  const titleId = useId();
  const shown = pending ?? profile.listVisibility;
  // Back to where it was opened from: the card (#37) or Perfil (#39).
  const fromCard = (useLocation().state as { from?: string } | null)?.from === '/tarjeta';

  async function choose(next: Visibility) {
    if (next === shown) return;
    setPending(next);
    setStatus(null);
    try {
      await save({ listVisibility: next });
      setStatus('saved');
      if (next === 'public') onListMadePublic?.({ source: 'privacy' });
    } catch (error) {
      setStatus({ failed: errorCode(error) });
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="privacy" aria-labelledby={titleId}>
      <Link className="card-preview__back" to={fromCard ? '/tarjeta' : '/perfil'}>
        {fromCard ? t('privacy.backToCard') : t('app.backToProfile')}
      </Link>
      <h1 className="card-step__title" id={titleId}>
        {t('privacy.title')}
      </h1>
      <p className="card-step__text">{t('privacy.text')}</p>
      <fieldset className="privacy__options" aria-labelledby={titleId}>
        {OPTIONS.map((option) => (
          <label key={option} className="privacy__option">
            <input
              type="radio"
              name="list-visibility"
              value={option}
              checked={shown === option}
              disabled={pending !== null}
              onChange={() => void choose(option)}
            />
            <span className="privacy__option-text">
              <span className="privacy__option-label">{t(`privacy.options.${option}.label`)}</span>
              <span className="privacy__option-detail">{t(`privacy.options.${option}.text`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <VisitorPreview profile={{ ...profile, listVisibility: shown }} />
      {status === 'saved' && (
        <p className="privacy__status" role="status">
          {t('app.saved')}
        </p>
      )}
      {status !== null && status !== 'saved' && (
        <p className="counter__error" role="alert">
          {errorMessage(status.failed) ?? t('app.saveFailed')}
        </p>
      )}
    </section>
  );
}
