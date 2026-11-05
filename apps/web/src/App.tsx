import { useEffect, useMemo, useState } from 'react';
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

  async function signIn() {
    setSigningIn(true);
    setSignInFailed(false);
    try {
      const { error } = await client.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
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

  if (session.isPending) return <main className="notice" aria-busy="true" />;
  if (!userId || me?.status === 'signed-out') {
    return <SignIn onContinue={signIn} busy={signingIn} failed={signInFailed} />;
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
      {...callbacks}
    />
  );
}
