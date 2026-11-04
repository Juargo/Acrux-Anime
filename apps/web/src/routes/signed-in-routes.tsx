import { type RouteObject, useParams } from 'react-router';
import { CardScreen } from '../card/CardScreen';
import { CatalogScreen } from '../catalog/CatalogScreen';
import { FranchiseScreen } from '../franchise/FranchiseScreen';
import { MyListScreen } from '../my-list/MyListScreen';
import { PrivacyScreen } from '../profile/PrivacyScreen';
import { useSignedIn } from './signed-in-context';

function CatalogPage() {
  const context = useSignedIn();
  return (
    <>
      <h1 className="visually-hidden">Explorar</h1>
      <CatalogScreen {...context} />
    </>
  );
}

// Any entry id of the franchise works, so a shared link survives a regrouping (RF-16).
function FranchisePage() {
  const context = useSignedIn();
  const { anilistId = '' } = useParams();
  return <FranchiseScreen key={anilistId} anilistId={Number(anilistId)} {...context} />;
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

// Screens behind the session gate of App, inside the signed-in layout (routes/Home.tsx).
export const signedInRoutes: RouteObject[] = [
  { index: true, element: <CatalogPage /> },
  { path: 'franquicia/:anilistId', element: <FranchisePage /> },
  { path: 'mi-lista', element: <MyListPage /> },
  { path: 'tarjeta', element: <CardPage /> },
  { path: 'privacidad', element: <PrivacyPage /> },
];
