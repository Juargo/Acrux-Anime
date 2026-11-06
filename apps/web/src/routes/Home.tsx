import { Outlet } from 'react-router';
import type { AniListClient } from '../anilist/client';
import type { CardGeneratedEvent, CardSharedEvent } from '../card/CardScreen';
import type { FranchiseMarkedEvent } from '../catalog/use-franchise-marks';
import { Avatar } from '../components/Avatar';
import { type CounterModeChangedEvent, TotalCounter } from '../counter/TotalCounter';
import type { ListMadePublicEvent } from '../profile/PrivacyScreen';
import { useOwnProfile } from '../profile/use-own-profile';
import type { Profile } from '../profile-api';
import { MainNav } from './MainNav';
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
  onCardGenerated?: ((event: CardGeneratedEvent) => void) | undefined;
  onCardShared?: ((event: CardSharedEvent) => void) | undefined;
  onListMadePublic?: ((event: ListMadePublicEvent) => void) | undefined;
  onFranchiseMarked?: ((event: FranchiseMarkedEvent) => void) | undefined;
  sessionStartedAt?: string | undefined;
  onReauthenticate?: (() => void) | undefined;
  onAccountDeleted?: (() => void) | undefined;
}) {
  const { getToken, client, fetchFn } = props;
  // The profile App loaded, then what the screens save (name, avatar, privacy).
  const [profile] = useOwnProfile({ initial: props.profile, getToken, fetchFn });
  const name = profile.displayName || 'Sin nombre';
  return (
    <main className="home">
      <header className="home__bar">
        <TotalCounter
          initialMode={profile.counterMode}
          getToken={getToken}
          client={client}
          fetchFn={fetchFn}
          onCounterModeChanged={props.onCounterModeChanged}
          initialShown={
            profile.shownTotal !== null && profile.shownMode !== null
              ? { total: profile.shownTotal, mode: profile.shownMode }
              : null
          }
        />
        <div className="home__account">
          <Avatar
            name={name}
            avatarUrl={profile.avatarUrl}
            avatarPreset={profile.avatarPreset}
            size={40}
            className="home__avatar"
          />
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
      <Outlet
        context={
          {
            getToken,
            client,
            fetchFn,
            counterMode: profile.counterMode,
            profile,
            onCardGenerated: props.onCardGenerated,
            onCardShared: props.onCardShared,
            onListMadePublic: props.onListMadePublic,
            onFranchiseMarked: props.onFranchiseMarked,
            onCounterModeChanged: props.onCounterModeChanged,
            onSignOut: props.onSignOut,
            signingOut: props.signingOut,
            sessionStartedAt: props.sessionStartedAt,
            onReauthenticate: props.onReauthenticate,
            onAccountDeleted: props.onAccountDeleted,
          } satisfies SignedInContext
        }
      />
      <MainNav />
    </main>
  );
}
