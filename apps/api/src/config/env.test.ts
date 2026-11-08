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

  it('lowercases the IDs, as Neon Auth signs them in the sub claim', () => {
    expect(parseEnv({ CURATOR_USER_IDS: '0B9E8D7C-6A5B' }).CURATOR_USER_IDS).toEqual([
      '0b9e8d7c-6a5b',
    ]);
  });

  it('means nobody when unset or empty', () => {
    expect(parseEnv({}).CURATOR_USER_IDS).toEqual([]);
    expect(parseEnv({ CURATOR_USER_IDS: '' }).CURATOR_USER_IDS).toEqual([]);
  });
});

describe('Lemon Squeezy (epic #50)', () => {
  it('leaves billing off when nothing is set, with the production Plus screen as return', () => {
    const env = parseEnv({});
    expect(env.LEMON_SQUEEZY_API_KEY).toBeUndefined();
    expect(env.LEMON_SQUEEZY_WEBHOOK_SECRET).toBeUndefined();
    expect(env.BILLING_RETURN_URL).toBe('https://app.acruxanime.com/perfil/plus');
  });

  it('takes empty values as not set', () => {
    expect(parseEnv({ LEMON_SQUEEZY_STORE_ID: '' }).LEMON_SQUEEZY_STORE_ID).toBeUndefined();
  });

  it('rejects a store or variant id that is not a number', () => {
    expect(() => parseEnv({ LEMON_SQUEEZY_STORE_ID: 'acrux' })).toThrow();
    expect(() => parseEnv({ LEMON_SQUEEZY_VARIANT_ID: '12a' })).toThrow();
  });

  it('rejects a short webhook secret and a return URL without https', () => {
    expect(() => parseEnv({ LEMON_SQUEEZY_WEBHOOK_SECRET: 'short' })).toThrow();
    expect(() =>
      parseEnv({ BILLING_RETURN_URL: 'http://app.acruxanime.com/perfil/plus' }),
    ).toThrow();
  });
});
