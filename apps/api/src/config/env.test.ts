import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('CURATOR_USER_IDS (#42)', () => {
  it('lists the comma-separated user IDs, ignoring spaces and empty entries', () => {
    expect(parseEnv({ CURATOR_USER_IDS: ' a1, b2 ,,c3 ' }).CURATOR_USER_IDS).toEqual([
      'a1',
      'b2',
      'c3',
    ]);
  });

  it('means nobody when unset or empty', () => {
    expect(parseEnv({}).CURATOR_USER_IDS).toEqual([]);
    expect(parseEnv({ CURATOR_USER_IDS: '' }).CURATOR_USER_IDS).toEqual([]);
  });
});
