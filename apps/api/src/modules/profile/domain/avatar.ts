import type { UserPlan } from '../../../http/plan.js';
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
  sakura: { background: '#ffb3cf', star: '#0b0d1c' },
  aurora: { background: '#5ee0d6', star: '#1b1f3b' },
  eclipse: { background: '#0b0d1c', star: '#ffd166' },
};

// The presets only Plus can pick (RF-55). The API refuses them without Plus.
export const PLUS_AVATAR_PRESETS: readonly AvatarPreset[] = ['sakura', 'aurora', 'eclipse'];

export const isPlusPreset = (preset: AvatarPreset | null | undefined) =>
  preset != null && PLUS_AVATAR_PRESETS.includes(preset);

// What others and the owner see: a Plus preset shows only while the owner is Plus. The stored
// value is kept, so a refund hides it and a later purchase brings it back (RF-56).
export const visiblePreset = (preset: AvatarPreset | null, plan: UserPlan) =>
  isPlusPreset(preset) && plan !== 'plus' ? null : preset;

export const SPARKLE_PATH =
  'M12 3c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8Z';

export function presetSvg(preset: AvatarPreset): string {
  const { background, star } = AVATAR_PRESETS[preset];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${background}"/><path d="${SPARKLE_PATH}" fill="${star}" transform="translate(6 6) scale(.5)"/></svg>`;
}
