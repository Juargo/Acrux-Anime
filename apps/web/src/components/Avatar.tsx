import type { AvatarPreset } from '../profile-api';

// The preset Acrux avatars of Figma M06 (#39), in the order M06 shows them. The API draws the
// same ones in the preview image (apps/api/src/modules/profile/domain/avatar.ts).
export const AVATAR_PRESETS: AvatarPreset[] = [
  'violeta',
  'verde',
  'amarillo',
  'coral',
  'noche',
  'lavanda',
];

// The presets only Plus can pick (RF-55); the API refuses them without Plus.
export const PLUS_AVATAR_PRESETS: AvatarPreset[] = ['sakura', 'aurora', 'eclipse'];

const SPARKLE = 'M12 3c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8Z';

/** The Acrux sparkle on the preset's color; size and color come from the .avatar classes. */
export function PresetArt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={SPARKLE} fill="currentColor" />
    </svg>
  );
}

/**
 * Presentational: a preset Acrux avatar wins over the Google photo; without either, the
 * initial. `decorative` hides it from assistive technology when the name is next to it.
 */
export function Avatar(props: {
  name: string;
  avatarUrl: string | null;
  avatarPreset: AvatarPreset | null;
  size: number;
  className?: string;
  decorative?: boolean;
}) {
  const { name, avatarUrl, avatarPreset, size, decorative = false } = props;
  const className = `avatar ${props.className ?? ''}`.trim();
  const label = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name };
  if (avatarPreset) {
    return (
      <span className={`${className} avatar--${avatarPreset}`} {...label}>
        <PresetArt />
      </span>
    );
  }
  if (avatarUrl) {
    return (
      <img
        className={className}
        src={avatarUrl}
        alt={decorative ? '' : name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span className={`${className} avatar--initial`} {...label}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
