// The display name rules of RF-07 and Figma M06 ("5/30"). A copy of @acrux/domain's
// (packages/domain/src/profile/display-name.ts), which ships TypeScript sources the compiled API
// cannot load; display-name.test.ts keeps both in agreement. The name arrives already trimmed.
export const DISPLAY_NAME_MAX = 30;

export type DisplayNameProblem = 'empty' | 'too-long' | 'invisible';

// Control and format characters and line or paragraph separators break the card and the
// preview image, or hide or reverse text; the zero-width joiner of emoji sequences stays.
const HIDDEN = /[\p{Cc}\p{Zl}\p{Zp}]|(?!‍)\p{Cf}/u;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

export function displayNameProblem(trimmed: string): DisplayNameProblem | null {
  if (trimmed.length === 0) return 'empty';
  // Code points, so an emoji counts once.
  if ([...trimmed].length > DISPLAY_NAME_MAX) return 'too-long';
  if (HIDDEN.test(trimmed) || !VISIBLE.test(trimmed)) return 'invisible';
  return null;
}
