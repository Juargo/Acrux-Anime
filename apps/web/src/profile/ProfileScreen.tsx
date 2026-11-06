import { useId, useState } from 'react';
import { Link } from 'react-router';
import { AnalyticsRow, useAnalyticsState } from '../analytics/AnalyticsContext';
import { Avatar } from '../components/Avatar';
import { useCounterMode } from '../counter/use-counter-mode';
import { type Profile, saveCounterMode } from '../profile-api';
import { useDataDownload } from './use-data-download';
import { useOwnProfile } from './use-own-profile';

const MODE_LABELS = { franchise: 'Franquicias', entry: 'Entradas' } as const;

/**
 * Container: "Perfil y ajustes" (Figma M16) with what works today (S4 of
 * odd/tasks/editar-perfil.md): who you are, "Editar", "Contar por", "Tu lista" and
 * "Cerrar sesión", plus "Descargar mis datos" and "Borrar cuenta" (#38). Idioma, Títulos,
 * Tema, AniList and Plus rows arrive with their issues.
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
  const [profile] = useOwnProfile({ initial, getToken, fetchFn });
  const [mode, setMode] = useCounterMode(initial.counterMode);
  const [savingMode, setSavingMode] = useState(false);
  const [modeFailed, setModeFailed] = useState(false);
  const titleId = useId();
  const { analytics } = useAnalyticsState();
  const data = useDataDownload({ getToken, fetchFn });
  const name = profile.displayName.trim() || 'Sin nombre';

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
        Perfil
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
          Editar
        </Link>
      </header>

      <h2 className="profile__group">PREFERENCIAS</h2>
      <ul className="profile__rows">
        <li>
          <button
            className="profile__row"
            type="button"
            disabled={savingMode}
            onClick={() => void switchMode()}
          >
            <span>Contar por</span>
            <span className="profile__value">{MODE_LABELS[mode]} ›</span>
          </button>
        </li>
        <li>
          <Link className="profile__row" to="/privacidad">
            <span>Tu lista</span>
            <span className="profile__value">
              {profile.listVisibility === 'public' ? 'Pública' : 'Privada'} ›
            </span>
          </Link>
        </li>
      </ul>
      {modeFailed && (
        <p className="counter__error" role="alert">
          No pudimos guardar cómo contar. Vuelve a intentarlo.
        </p>
      )}

      <h2 className="profile__group">CUENTA Y PRIVACIDAD</h2>
      <ul className="profile__rows">
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
            <span>Descargar mis datos</span>
            <span className="profile__value" aria-hidden="true">
              ⤓
            </span>
          </button>
        </li>
        <li>
          <Link className="profile__row profile__row--danger" to="/perfil/borrar-cuenta">
            <span>Borrar cuenta</span>
            <span className="profile__value" aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <button className="profile__row" type="button" onClick={onSignOut} disabled={signingOut}>
            <span>Cerrar sesión</span>
            <span className="profile__value" aria-hidden="true">
              ›
            </span>
          </button>
        </li>
      </ul>
      {data.failed && (
        <p className="counter__error" role="alert">
          No pudimos descargar tus datos. Vuelve a intentarlo.
        </p>
      )}
    </section>
  );
}
