import type { AvatarPreset } from '../repositories/profile.repository.js';

// The preset Acrux avatars of Figma M06 (#39): the app's color tokens with the Acrux sparkle.
// apps/web/src/components/Avatar.tsx draws the same ones.
export const AVATAR_PRESETS: Record<AvatarPreset, { background: string; star: string }> = {
  violeta: { background: '#9d8cf5', star: '#0b0d1c' },
  verde: { background: '#4fd1a5', star: '#0b0d1c' },
  amarillo: { background: '#ffd166', star: '#0b0d1c' },
  coral: { background: '#ff7a7a', star: '#0b0d1c' },
  noche: { background: '#1b1f3b', star: '#9d8cf5' },
  lavanda: { background: '#c3b8ff', star: '#0b0d1c' },
};

export const SPARKLE_PATH =
  'M12 3c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8Z';

export function presetSvg(preset: AvatarPreset): string {
  const { background, star } = AVATAR_PRESETS[preset];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${background}"/><path d="${SPARKLE_PATH}" fill="${star}" transform="translate(6 6) scale(.5)"/></svg>`;
}
