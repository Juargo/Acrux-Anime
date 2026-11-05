import { describe, expect, it } from 'vitest';
import { DISPLAY_NAME_MAX, displayNameProblem } from './display-name';

describe('displayNameProblem', () => {
  it.each(['Cami', 'José Ñúñez', 'Ana 👩‍💻', '李', 'a'.repeat(29) + '🌸'])('accepts %j', (name) => {
    expect(displayNameProblem(name)).toBeNull();
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    [' 　', 'empty'],
    ['a'.repeat(DISPLAY_NAME_MAX + 1), 'too-long'],
    ['Cami\tla', 'invisible'],
    ['Cami\nla', 'invisible'],
    ['Cami la', 'invisible'],
    ['Ca‮mila', 'invisible'],
    ['​​', 'invisible'],
  ])('rejects %j as %s', (name, problem) => {
    expect(displayNameProblem(name.trim())).toBe(problem);
  });
});
