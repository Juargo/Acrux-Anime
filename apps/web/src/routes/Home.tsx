import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import type { AniListClient } from '../anilist/client';
import type { CardGeneratedEvent, CardSharedEvent } from '../card/CardScreen';
import type { FranchiseMarkedEvent } from '../catalog/use-franchise-marks';
import { Avatar } from '../components/Avatar';
import { type CounterModeChangedEvent, TotalCounter } from '../counter/TotalCounter';
import type { ListMadePublicEvent } from '../profile/PrivacyScreen';
import { useOwnProfile } from '../profile/use-own-profile';
import type { Profile } from '../profile-api';
import { InstallPrompt } from '../pwa/InstallSuggestion';
import type { InstallEnvironment, InstallStore } from '../pwa/install';
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
  // Tests inject the browser's install event and environment (#44).
  install?: { store?: InstallStore; environment?: InstallEnvironment } | undefined;
}) {
  const { t } = useTranslation();
  const { getToken, client, fetchFn } = props;
  // The install suggestion waits for the first anime marked as seen (ADR-0016).
  const [markedSeen, setMarkedSeen] = useState(false);
  // The profile App loaded, then what the screens save (name, avatar, privacy).
  const [profile] = useOwnProfile({ initial: props.profile, getToken, fetchFn });
  const name = profile.displayName || t('app.noName');
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
            {t('app.signOut')}
          </button>
        </div>
      </header>
      {props.signOutFailed && (
        <p className="home__error" role="alert">
          {t('app.signOutFailed')}
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
            onFranchiseMarked: (event) => {
              props.onFranchiseMarked?.(event);
              if (event.status === 'seen') setMarkedSeen(true);
            },
            onEntryMarkedSeen: () => setMarkedSeen(true),
            onCounterModeChanged: props.onCounterModeChanged,
            onSignOut: props.onSignOut,
            signingOut: props.signingOut,
            sessionStartedAt: props.sessionStartedAt,
            onReauthenticate: props.onReauthenticate,
            onAccountDeleted: props.onAccountDeleted,
          } satisfies SignedInContext
        }
      />
      <InstallPrompt
        show={markedSeen}
        store={props.install?.store}
        environment={props.install?.environment}
      />
      <MainNav />
    </main>
  );
}
