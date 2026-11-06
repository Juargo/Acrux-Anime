import { useEffect, useMemo, useState } from 'react';
import { finishAccountDeletion } from './account-deletion';
import { useAnalyticsState } from './analytics/AnalyticsContext';
import { eventCallbacks } from './analytics/events';
import { auth } from './auth';
import { fetchMe, type MeResult } from './profile-api';
import { Home } from './routes/Home';
import { SignIn } from './routes/SignIn';

type AuthClient = NonNullable<typeof auth>;

// The adapter puts the Neon Auth JWT in session.token and caches it until it expires.
async function sessionToken(client: AuthClient): Promise<string | null> {
  const { data } = await client.getSession();
  return data?.session.token ?? null;
}

// Neon Auth gives the session start as a date or its ISO string, depending on the cache.
function sessionStart(value: Date | string | undefined): string | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  return value;
}

// Container: owns the session and the profile; the routes only render.
export function App() {
  if (!auth) {
    return (
      <main className="notice">
        <p>El inicio de sesión no está disponible en este entorno.</p>
      </main>
    );
  }
  return <SignedApp client={auth} />;
}

function SignedApp({ client }: { client: AuthClient }) {
  const session = client.useSession();
  const userId = session.data?.user.id;
  const [me, setMe] = useState<MeResult | undefined>();
  const [signingIn, setSigningIn] = useState(false);
  const [signInFailed, setSignInFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);

  useEffect(() => {
    setMe(undefined);
    if (!userId) return;
    let current = true;
    fetchMe(() => sessionToken(client))
      .then((result) => {
        if (current) setMe(result);
      })
      .catch(() => {
        if (current) setMe({ status: 'error', requestId: undefined });
      });
    return () => {
      current = false;
    };
  }, [client, userId]);

  // `returnTo` brings the user back after Google, as when deleting the account asks for a
  // fresh session (RF-06).
  async function signIn(returnTo = '/') {
    setSigningIn(true);
    setSignInFailed(false);
    setAccountDeleted(false);
    try {
      const { error } = await client.signIn.social({
        provider: 'google',
        callbackURL: new URL(returnTo, window.location.origin).toString(),
      });
      if (error) throw error;
    } catch {
      setSignInFailed(true);
      setSigningIn(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await client.signOut();
      // The next account on this device is another person in analytics (#46).
      analytics?.forget();
      // The session hook then reports no user and the sign-in screen returns.
      setMe(undefined);
    } catch {
      // The session is still alive on Neon Auth: stay, and say so.
      setSignOutFailed(true);
    } finally {
      setSigningOut(false);
    }
  }

  // After consent, PostHog knows the user by the salted id of /me (#46).
  const { analytics } = useAnalyticsState();
  const callbacks = useMemo(() => (analytics ? eventCallbacks(analytics) : {}), [analytics]);
  const profile = me?.status === 'ok' ? me.profile : undefined;
  useEffect(() => {
    if (profile) {
      analytics?.identify({ analyticsId: profile.analyticsId, createdAt: profile.createdAt });
    }
  }, [analytics, profile]);

  // Once deleted, the app never asks for /me again with the old token: it would recreate the
  // profile while that token lasts.
  async function accountWasDeleted() {
    setAccountDeleted(true);
    setMe(undefined);
    await finishAccountDeletion({ analytics, signOut: () => client.signOut() });
  }

  if (accountDeleted) {
    return (
      <SignIn
        onContinue={() => void signIn()}
        busy={signingIn}
        failed={signInFailed}
        notice="Borramos tu cuenta y tus datos."
      />
    );
  }
  if (session.isPending) return <main className="notice" aria-busy="true" />;
  if (!userId || me?.status === 'signed-out') {
    return <SignIn onContinue={() => void signIn()} busy={signingIn} failed={signInFailed} />;
  }
  if (!me) return <main className="notice" aria-busy="true" />;
  if (me.status === 'error') {
    return (
      <main className="notice">
        <p role="alert">
          No pudimos cargar tu perfil. Recarga la página.
          {me.requestId && <span className="notice__id"> Código: {me.requestId}</span>}
        </p>
      </main>
    );
  }
  return (
    <Home
      profile={me.profile}
      onSignOut={signOut}
      signingOut={signingOut}
      signOutFailed={signOutFailed}
      getToken={() => sessionToken(client)}
      sessionStartedAt={sessionStart(session.data?.session.createdAt)}
      onReauthenticate={() => void signIn('/perfil/borrar-cuenta')}
      onAccountDeleted={() => void accountWasDeleted()}
      {...callbacks}
    />
  );
}
