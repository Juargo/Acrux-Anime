import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { Profile } from '../profile-api';
import { useOwnProfile } from './use-own-profile';

// ADR-0030: no personal data; where the list was made public.
export type ListMadePublicEvent = { source: 'privacy' | 'first_share' };

type Visibility = Profile['listVisibility'];

const OPTIONS: { value: Visibility; label: string; text: string }[] = [
  { value: 'private', label: 'Privada', text: 'Quien abra tu enlace solo verá tu total.' },
  {
    value: 'public',
    label: 'Pública',
    text: 'Verán tu total, lo que estás viendo y tus sagas más recientes.',
  },
];

/** Presentational: "ASÍ TE VE UN VISITANTE" of Figma M17. */
function VisitorPreview({ profile }: { profile: Profile }) {
  const name = profile.displayName.trim() || 'Tu perfil';
  return (
    <section className="privacy__preview" aria-label="ASÍ TE VE UN VISITANTE">
      <h2 className="privacy__label">ASÍ TE VE UN VISITANTE</h2>
      <div className="privacy__card">
        {profile.shownTotal !== null && (
          <p className="public-profile__total">
            <span className="public-profile__count">{profile.shownTotal}</span>
            <span className="public-profile__label">
              {profile.shownMode === 'entry' ? 'ENTRADAS VISTAS' : 'ANIMES COMPLETOS'}
            </span>
          </p>
        )}
        {profile.listVisibility === 'private' ? (
          <p className="privacy__note">
            <span aria-hidden="true">🔒 </span>
            {name} mantiene su lista privada
          </p>
        ) : (
          <p className="privacy__note">Verán lo que estás viendo y tus sagas más recientes.</p>
        )}
      </div>
      <Link className="privacy__link" to={`/@${profile.handle}`}>
        Ver mi perfil público
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
  const [status, setStatus] = useState<'saved' | 'failed' | null>(null);
  const titleId = useId();
  const shown = pending ?? profile.listVisibility;

  async function choose(next: Visibility) {
    if (next === shown) return;
    setPending(next);
    setStatus(null);
    try {
      await save({ listVisibility: next });
      setStatus('saved');
      if (next === 'public') onListMadePublic?.({ source: 'privacy' });
    } catch {
      setStatus('failed');
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="privacy" aria-labelledby={titleId}>
      <Link className="card-preview__back" to="/perfil">
        ‹ Perfil
      </Link>
      <h1 className="card-step__title" id={titleId}>
        ¿Quién ve tu lista?
      </h1>
      <p className="card-step__text">Tu total siempre se ve en tu tarjeta y tu enlace.</p>
      <fieldset className="privacy__options" aria-labelledby={titleId}>
        {OPTIONS.map((option) => (
          <label key={option.value} className="privacy__option">
            <input
              type="radio"
              name="list-visibility"
              value={option.value}
              checked={shown === option.value}
              disabled={pending !== null}
              onChange={() => void choose(option.value)}
            />
            <span className="privacy__option-text">
              <span className="privacy__option-label">{option.label}</span>
              <span className="privacy__option-detail">{option.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <VisitorPreview profile={{ ...profile, listVisibility: shown }} />
      {status === 'saved' && (
        <p className="privacy__status" role="status">
          Listo, guardado.
        </p>
      )}
      {status === 'failed' && (
        <p className="counter__error" role="alert">
          No pudimos guardar. Vuelve a intentarlo.
        </p>
      )}
    </section>
  );
}
