import { Outlet } from 'react-router';
import type { AniListClient } from '../anilist/client';
import { type CounterModeChangedEvent, TotalCounter } from '../counter/TotalCounter';
import type { Profile } from '../profile-api';
import type { SignedInContext } from './signed-in-context';

// Signed-in layout: the total counter (#34), who you are and how to leave in the bar fixed at
// the top (Figma M03); the catalog (#31) or a franchise detail (#32) below it.
export function Home(props: {
  profile: Profile;
  onSignOut: () => void;
  signingOut: boolean;
  signOutFailed: boolean;
  getToken: () => Promise<string | null>;
  // Tests inject AniList and the API; the screens below get the same ones.
  client?: AniListClient | undefined;
  fetchFn?: typeof fetch | undefined;
  onCounterModeChanged?: ((event: CounterModeChangedEvent) => void) | undefined;
}) {
  const { profile, getToken, client, fetchFn } = props;
  const name = profile.displayName || 'Sin nombre';
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || '?';
  return (
    <main className="home">
      <header className="home__bar">
        <TotalCounter
          initialMode={profile.counterMode}
          getToken={getToken}
          client={client}
          fetchFn={fetchFn}
          onCounterModeChanged={props.onCounterModeChanged}
        />
        <div className="home__account">
          {profile.avatarUrl ? (
            <img
              className="home__avatar"
              src={profile.avatarUrl}
              alt={name}
              width={40}
              height={40}
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="home__avatar home__avatar--initial" role="img" aria-label={name}>
              {initial}
            </span>
          )}
          <button
            className="button button--secondary"
            type="button"
            onClick={props.onSignOut}
            disabled={props.signingOut}
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      {props.signOutFailed && (
        <p className="home__error" role="alert">
          No pudimos cerrar tu sesión. Vuelve a intentarlo.
        </p>
      )}
      <Outlet context={{ getToken, client, fetchFn } satisfies SignedInContext} />
    </main>
  );
}
