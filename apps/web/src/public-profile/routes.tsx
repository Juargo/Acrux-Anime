import { type RouteObject, useParams } from 'react-router';
import type { CatalogClient } from '../catalog-source/client';
import { PublicProfileScreen, type PublicProfileViewedEvent } from './PublicProfileScreen';

// "/@jorge": a path segment that starts with @ (Figma M07 "acrux.app/@jorge"). Any other
// single segment no route of the app knows lands here too and shows "Perfil no disponible".
function PublicProfilePage(props: {
  client?: CatalogClient | undefined;
  fetchFn?: typeof fetch | undefined;
  onViewed?: ((event: PublicProfileViewedEvent) => void) | undefined;
}) {
  const { profile = '' } = useParams();
  const handle = profile.startsWith('@') ? profile.slice(1) : '';
  return <PublicProfileScreen key={handle} handle={handle} {...props} />;
}

// Outside the session gate of App: visitors need no account (RF-40).
export function publicProfileRoute(
  props: {
    client?: CatalogClient | undefined;
    fetchFn?: typeof fetch | undefined;
    onViewed?: ((event: PublicProfileViewedEvent) => void) | undefined;
  } = {},
): RouteObject {
  return { path: '/:profile', element: <PublicProfilePage {...props} /> };
}
