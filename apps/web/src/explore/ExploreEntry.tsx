import { Navigate } from 'react-router';
import { MAP_PATH, readLastWorld, WORLD_PATH } from './last-world';

/**
 * Where Explorar opens: the last world visited, or the map while there is none. It replaces the
 * history entry, so the back button never returns to an address that only redirects.
 */
export function ExploreEntry() {
  const last = readLastWorld();
  return <Navigate to={last ? WORLD_PATH[last] : MAP_PATH} replace />;
}
