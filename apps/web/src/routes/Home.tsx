import { CatalogScreen } from '../catalog/CatalogScreen';
import { Logo } from '../components/Logo';
import type { Profile } from '../profile-api';

// Signed-in home: the catalog (#31), with who you are and how to leave in the bar.
export function Home(props: {
  profile: Profile;
  onSignOut: () => void;
  signingOut: boolean;
  signOutFailed: boolean;
}) {
  const { profile } = props;
  const name = profile.displayName || 'Sin nombre';
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || '?';
  return (
    <main className="home">
      <header className="home__bar">
        <Logo />
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
      <h1 className="visually-hidden">Explorar</h1>
      <CatalogScreen />
    </main>
  );
}
