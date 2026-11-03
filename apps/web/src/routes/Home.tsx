import { Logo } from '../components/Logo';
import type { Profile } from '../profile-api';

// Signed-in shell until the catalog lands (#31 onwards): who you are and how to leave.
export function Home(props: { profile: Profile; onSignOut: () => void; signingOut: boolean }) {
  const { profile } = props;
  const initial = profile.displayName.trim().charAt(0).toUpperCase() || '?';
  return (
    <main className="home">
      <header className="home__bar">
        <Logo />
        <button
          className="button button--secondary"
          type="button"
          onClick={props.onSignOut}
          disabled={props.signingOut}
        >
          Cerrar sesión
        </button>
      </header>
      <section className="home__profile">
        {profile.avatarUrl ? (
          <img
            className="home__avatar"
            src={profile.avatarUrl}
            alt=""
            width={64}
            height={64}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="home__avatar home__avatar--initial">{initial}</span>
        )}
        <div>
          <h1 className="home__name">{profile.displayName || 'Sin nombre'}</h1>
          <p className="home__meta">
            {profile.listVisibility === 'private' ? 'Tu lista es privada' : 'Tu lista es pública'}
          </p>
        </div>
      </section>
    </main>
  );
}
