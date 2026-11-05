import { describe, expect, it } from 'vitest';
import { displayNameProblem as editorRule } from '../../../../../../packages/domain/src/profile/display-name.js';
import { displayNameProblem } from './display-name.js';

// The editor (apps/web, through @acrux/domain) and the API must agree on every name, or the
// editor would accept a name the API rejects (#39).
const NAMES = [
  'Cami',
  'José Ñúñez',
  'Ana 👩‍💻',
  '李',
  `${'a'.repeat(29)}🌸`,
  '',
  'a'.repeat(31),
  'Cami\tla',
  'Cami\nla',
  'Cami la',
  'Cami la',
  'Ca‮mila',
  '​​',
  '‏',
  'Cami\u0007',
  '́',
];

describe('displayNameProblem', () => {
  it.each(NAMES)('gives %j the same answer as the editor', (name) => {
    expect(displayNameProblem(name)).toBe(editorRule(name));
  });
});
