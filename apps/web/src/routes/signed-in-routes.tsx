import { type RouteObject, useNavigate, useParams, useSearchParams } from 'react-router';
import { BadgesScreen } from '../badges/BadgesScreen';
import { CardScreen } from '../card/CardScreen';
import { CatalogScreen } from '../catalog/CatalogScreen';
import { eraYears } from '../catalog/eras';
import { CuratorScreen } from '../curator/CuratorScreen';
import { ORIGINS } from '../drama-source/client';
import { DramasScreen } from '../dramas/DramasScreen';
import { ExploreEntry } from '../explore/ExploreEntry';
import { useRememberWorld } from '../explore/last-world';
import { WorldHeader } from '../explore/WorldHeader';
import { WorldsMap } from '../explore/WorldsMap';
import { FranchiseScreen } from '../franchise/FranchiseScreen';
import { MyListScreen } from '../my-list/MyListScreen';
import { PlusScreen } from '../plus/PlusScreen';
import { AboutScreen } from '../profile/AboutScreen';
import { DeleteAccountScreen } from '../profile/DeleteAccountScreen';
import { PrivacyScreen } from '../profile/PrivacyScreen';
import { ProfileEditor } from '../profile/ProfileEditor';
import { ProfileScreen } from '../profile/ProfileScreen';
import { StatsScreen } from '../stats/StatsScreen';
import { useSignedIn } from './signed-in-context';

// The Anime world of Explorar.
function CatalogPage() {
  const context = useSignedIn();
  // A door of the map opens the world on one era.
  const [params] = useSearchParams();
  const initialYears = eraYears(params.get('era'), new Date().getFullYear());
  useRememberWorld('anime');
  // The world header is part of the screen: it holds the levels of the catalog.
  return <CatalogScreen {...context} initialYears={initialYears} />;
}

// The dramas live apart from the anime catalog (#151); the session is for their marks (#154).
function DramasPage() {
  const { getToken, fetchFn } = useSignedIn();
  // A door of the map opens the world on one country.
  const [params] = useSearchParams();
  const initialOrigin = ORIGINS.find((origin) => origin === params.get('origin'));
  useRememberWorld('dramas');
  return (
    <>
      <WorldHeader world="dramas" />
      <DramasScreen getToken={getToken} fetchFn={fetchFn} initialOrigin={initialOrigin} />
    </>
  );
}

// Any entry id of the franchise works, so a shared link survives a regrouping (RF-16).
function FranchisePage() {
  const context = useSignedIn();
  const { animeId = '' } = useParams();
  return <FranchiseScreen key={animeId} animeId={Number(animeId)} {...context} />;
}

function MyListPage() {
  return <MyListScreen {...useSignedIn()} />;
}

function CardPage() {
  return <CardScreen {...useSignedIn()} />;
}

function PrivacyPage() {
  return <PrivacyScreen {...useSignedIn()} />;
}

function ProfilePage() {
  return <ProfileScreen {...useSignedIn()} />;
}

function StatsPage() {
  const context = useSignedIn();
  return (
    <StatsScreen
      profile={context.profile}
      getToken={context.getToken}
      fetchFn={context.fetchFn}
      client={context.client}
    />
  );
}

function BadgesPage() {
  const context = useSignedIn();
  return (
    <BadgesScreen
      profile={context.profile}
      getToken={context.getToken}
      fetchFn={context.fetchFn}
      client={context.client}
    />
  );
}

function PlusPage() {
  const context = useSignedIn();
  return (
    <PlusScreen
      initial={context.profile}
      getToken={context.getToken}
      fetchFn={context.fetchFn}
      openCheckout={context.openCheckout}
      polling={context.plusPolling}
      onCheckoutStarted={context.onPlusCheckoutStarted}
      onPurchased={context.onPlusPurchased}
    />
  );
}

function DeleteAccountPage() {
  const context = useSignedIn();
  return (
    <DeleteAccountScreen
      getToken={context.getToken}
      fetchFn={context.fetchFn}
      sessionStartedAt={context.sessionStartedAt}
      onAccountDeleted={() => context.onAccountDeleted?.()}
      onReauthenticate={() => context.onReauthenticate?.()}
    />
  );
}

function ProfileEditorPage() {
  const navigate = useNavigate();
  return (
    <ProfileEditor
      {...useSignedIn()}
      onBack={() => navigate('/perfil')}
      onDone={() => navigate('/perfil')}
    />
  );
}

// Visible to everyone with the link; only the curator gets the form, and the API checks (#42).
function CuratorPage() {
  const { profile, getToken, client, fetchFn } = useSignedIn();
  return (
    <CuratorScreen
      curator={profile.curator === true}
      getToken={getToken}
      client={client}
      fetchFn={fetchFn}
    />
  );
}

// Screens behind the session gate of App, inside the signed-in layout (routes/Home.tsx).
export const signedInRoutes: RouteObject[] = [
  // Explorar: `/` only decides between the last world visited and the map.
  { index: true, element: <ExploreEntry /> },
  { path: 'mundos', element: <WorldsMap /> },
  { path: 'anime', element: <CatalogPage /> },
  { path: 'dramas', element: <DramasPage /> },
  { path: 'franquicia/:animeId', element: <FranchisePage /> },
  { path: 'mi-lista', element: <MyListPage /> },
  { path: 'tarjeta', element: <CardPage /> },
  { path: 'privacidad', element: <PrivacyPage /> },
  { path: 'perfil', element: <ProfilePage /> },
  { path: 'perfil/editar', element: <ProfileEditorPage /> },
  { path: 'perfil/borrar-cuenta', element: <DeleteAccountPage /> },
  { path: 'perfil/acerca-de', element: <AboutScreen /> },
  { path: 'perfil/plus', element: <PlusPage /> },
  { path: 'perfil/estadisticas', element: <StatsPage /> },
  { path: 'perfil/insignias', element: <BadgesPage /> },
  { path: 'curador', element: <CuratorPage /> },
];
