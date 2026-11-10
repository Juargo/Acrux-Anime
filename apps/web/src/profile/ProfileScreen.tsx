import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AnalyticsRow, useAnalyticsState } from '../analytics/AnalyticsContext';
import { errorMessage } from '../api-errors';
import { Avatar } from '../components/Avatar';
import { useCounterMode } from '../counter/use-counter-mode';
import { type Profile, saveCounterMode } from '../profile-api';
import { LanguageRow } from './LanguageRow';
import { useDataDownload } from './use-data-download';
import { useOwnProfile } from './use-own-profile';

/**
 * Container: "Perfil y ajustes" (Figma M16) with what works today (S4 of
 * odd/tasks/editar-perfil.md): who you are, "Editar", "Contar por", "Tu lista" and
 * "Cerrar sesión", plus "Descargar mis datos" and "Borrar cuenta" (#38), "Acerca de" (#45) and "Idioma"
 * (#43). Títulos, Tema, AniList and Plus rows arrive with their issues.
 */
export function ProfileScreen({
  profile: initial,
  getToken,
  fetchFn,
  onSignOut,
  signingOut = false,
  onCounterModeChanged,
}: {
  profile: Profile;
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  onSignOut: () => void;
  signingOut?: boolean | undefined;
  onCounterModeChanged?: ((event: { mode: Profile['counterMode'] }) => void) | undefined;
}) {
  const { t } = useTranslation();
  const [profile, save] = useOwnProfile({ initial, getToken, fetchFn });
  const [mode, setMode] = useCounterMode(initial.counterMode);
  const [savingMode, setSavingMode] = useState(false);
  const [modeFailed, setModeFailed] = useState(false);
  const titleId = useId();
  const { analytics } = useAnalyticsState();
  const data = useDataDownload({ getToken, fetchFn });
  const name = profile.displayName.trim() || t('app.noName');

  // The same switch as the header counter (RF-25): at once, saved, back if saving fails.
  async function switchMode() {
    const previous = mode;
    const next = mode === 'franchise' ? 'entry' : 'franchise';
    setMode(next);
    setSavingMode(true);
    setModeFailed(false);
    try {
      await saveCounterMode(getToken, next, fetchFn);
      onCounterModeChanged?.({ mode: next });
    } catch {
      setMode(previous);
      setModeFailed(true);
    } finally {
      setSavingMode(false);
    }
  }

  return (
    <section className="profile" aria-labelledby={titleId}>
      <h1 className="visually-hidden" id={titleId}>
        {t('profile.title')}
      </h1>
      <header className="profile__header">
        <Avatar
          name={name}
          avatarUrl={profile.avatarUrl}
          avatarPreset={profile.avatarPreset}
          size={56}
          className="profile__avatar"
          decorative
        />
        <div className="profile__who">
          <h2 className="profile__name">{name}</h2>
          <p className="profile__link">
            @{profile.handle} · {window.location.host}/@{profile.handle}
          </p>
        </div>
        <Link className="button button--secondary" to="/perfil/editar">
          {t('profile.edit')}
        </Link>
      </header>

      <h2 className="profile__group">{t('profile.preferences')}</h2>
      <ul className="profile__rows">
        <li>
          <button
            className="profile__row"
            type="button"
            disabled={savingMode}
            onClick={() => void switchMode()}
          >
            <span>{t('profile.countBy')}</span>
            <span className="profile__value">{t(`profile.mode.${mode}`)} ›</span>
          </button>
        </li>
        <li>
          <LanguageRow locale={profile.locale} save={save} />
        </li>
        <li>
          <Link className="profile__row" to="/perfil/estadisticas">
            <span>{t('profile.stats')}</span>
            <span className="profile__value" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link className="profile__row" to="/perfil/insignias">
            <span>{t('profile.badges')}</span>
            <span className="profile__value" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link className="profile__row" to="/privacidad">
            <span>{t('profile.yourList')}</span>
            <span className="profile__value">
              {t(`profile.visibility.${profile.listVisibility}`)} ›
            </span>
          </Link>
        </li>
      </ul>
      {modeFailed && (
        <p className="counter__error" role="alert">
          {t('profile.modeFailed')}
        </p>
      )}

      <h2 className="profile__group">{t('profile.accountAndPrivacy')}</h2>
      <ul className="profile__rows">
        {(profile.plan === 'plus' || profile.plusAvailable) && (
          <li>
            <Link className="profile__row" to="/perfil/plus">
              <span>{t('profile.plus')}</span>
              <span className="profile__value">
                {t(profile.plan === 'plus' ? 'profile.planPlus' : 'profile.planFree')} ›
              </span>
            </Link>
          </li>
        )}
        {analytics?.enabled && (
          <li>
            <AnalyticsRow />
          </li>
        )}
        <li>
          <button
            className="profile__row"
            type="button"
            disabled={data.downloading}
            onClick={() => void data.download()}
          >
            <span>{t('profile.downloadData')}</span>
            <span className="profile__value" aria-hidden="true">
              ⤓
            </span>
          </button>
        </li>
        <li>
          <Link className="profile__row profile__row--danger" to="/perfil/borrar-cuenta">
            <span>{t('profile.deleteAccount')}</span>
            <span className="profile__value" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        {profile.curator && (
          <li>
            <Link className="profile__row" to="/curador">
              <span>{t('profile.curator')}</span>
              <span className="profile__value" aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        )}
        <li>
          <Link className="profile__row" to="/perfil/acerca-de">
            <span>{t('profile.about')}</span>
            <span className="profile__value" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <button className="profile__row" type="button" onClick={onSignOut} disabled={signingOut}>
            <span>{t('app.signOut')}</span>
            <span className="profile__value" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      </ul>
      {data.failed && (
        <p className="counter__error" role="alert">
          {errorMessage(data.code) ?? t('app.downloadFailed')}
        </p>
      )}
    </section>
  );
}
