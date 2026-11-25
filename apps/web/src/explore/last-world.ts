import { useEffect } from 'react';

// The worlds of Explorar that can be entered. Series joins them when its catalog exists.
export const WORLDS = ['anime', 'dramas'] as const;
export type World = (typeof WORLDS)[number];

export const WORLD_PATH: Record<World, string> = { anime: '/anime', dramas: '/dramas' };
export const MAP_PATH = '/mundos';

const STORAGE_KEY = 'acrux.lastWorld';

// Kept on the device, not in the account: it is where this screen was left, not a preference.
export function readLastWorld(): World | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return WORLDS.find((world) => world === value) ?? null;
  } catch {
    return null;
  }
}

function rememberWorld(world: World) {
  try {
    window.localStorage.setItem(STORAGE_KEY, world);
  } catch {
    // Without storage Explorar opens on the map every time.
  }
}

/** Marks the world on screen as the one Explorar reopens. */
export function useRememberWorld(world: World) {
  useEffect(() => rememberWorld(world), [world]);
}
