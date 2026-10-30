import { describe, expect, it } from 'vitest';
import { CONSENT_KEY, readConsent, utmProperties, writeConsent } from './consent';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
} as unknown as Storage;

describe('readConsent', () => {
  it('is undecided when nothing was stored', () => {
    expect(readConsent(memoryStorage())).toBe('undecided');
  });

  it('returns a stored choice', () => {
    expect(readConsent(memoryStorage({ [CONSENT_KEY]: 'granted' }))).toBe('granted');
    expect(readConsent(memoryStorage({ [CONSENT_KEY]: 'denied' }))).toBe('denied');
  });

  it('treats an unknown value as undecided', () => {
    expect(readConsent(memoryStorage({ [CONSENT_KEY]: 'yes' }))).toBe('undecided');
  });

  it('treats blocked storage as undecided', () => {
    expect(readConsent(throwingStorage)).toBe('undecided');
  });
});

describe('writeConsent', () => {
  it('stores the choice so it is read back', () => {
    const storage = memoryStorage();
    writeConsent(storage, 'denied');
    expect(readConsent(storage)).toBe('denied');
  });

  it('does not throw when storage is blocked', () => {
    expect(() => writeConsent(throwingStorage, 'granted')).not.toThrow();
  });
});

describe('utmProperties', () => {
  it('keeps only the UTM parameters', () => {
    expect(utmProperties('?utm_source=tiktok&utm_campaign=beta&email=a@b.com&ref=x')).toEqual({
      utm_source: 'tiktok',
      utm_campaign: 'beta',
    });
  });

  it('is empty without UTM parameters', () => {
    expect(utmProperties('')).toEqual({});
  });
});
