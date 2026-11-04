import { describe, expect, it } from 'vitest';
import { handleBase, handleCandidates, isHandle, randomCandidate } from './handle.js';

describe('handleBase', () => {
  it('lowercases the display name and drops accents and spaces', () => {
    expect(handleBase('Jorge')).toBe('jorge');
    expect(handleBase('José Ñúñez')).toBe('josenunez');
    expect(handleBase('  Ana_María 99 ')).toBe('ana_maria99');
  });

  it('spells out letters without a decomposition and folds fullwidth ones', () => {
    expect(handleBase('Łukasz')).toBe('lukasz');
    expect(handleBase('Œuvre Ærø')).toBe('oeuvreaero');
    expect(handleBase('Straße')).toBe('strasse');
    expect(handleBase('Ｊｏｒｇｅ')).toBe('jorge');
  });

  it('keeps only a-z, 0-9 and _ and cuts at 20 characters', () => {
    expect(handleBase('Kaguya-sama ♥ Love is War!')).toBe('kaguyasamaloveiswar');
    expect(handleBase('Abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnopqrst');
  });

  it('falls back to "usuario" when fewer than 3 characters are left', () => {
    expect(handleBase('')).toBe('usuario');
    expect(handleBase('李')).toBe('usuario');
    expect(handleBase('Al')).toBe('usuario');
  });

  it('skips the reserved words of routes and brand', () => {
    expect(handleBase('Admin')).toBe('usuario');
    expect(handleBase('Acrux')).toBe('usuario');
    expect(handleBase('API')).toBe('usuario');
  });
});

describe('handleCandidates', () => {
  it('starts with the base and then appends 2, 3, … without passing 20 characters', () => {
    expect(handleCandidates('jorge', 3)).toEqual(['jorge', 'jorge2', 'jorge3']);
    expect(handleCandidates('abcdefghijklmnopqrst', 2)).toEqual([
      'abcdefghijklmnopqrst',
      'abcdefghijklmnopqrs2',
    ]);
  });
});

describe('randomCandidate', () => {
  it('appends a random number to the base, within 20 characters', () => {
    expect(randomCandidate('usuario', () => 0.25)).toBe('usuario250000');
    expect(randomCandidate('abcdefghijklmnopqrst', () => 0.5)).toBe('abcdefghijklmn500000');
    expect(isHandle(randomCandidate('abcdefghijklmnopqrst', Math.random))).toBe(true);
  });
});

describe('isHandle', () => {
  it('accepts what the generator produces and rejects anything else', () => {
    expect(isHandle('jorge')).toBe(true);
    expect(isHandle('jorge_2')).toBe(true);
    expect(isHandle('Jorge')).toBe(false);
    expect(isHandle('jo')).toBe(false);
    expect(isHandle('a'.repeat(21))).toBe(false);
    expect(isHandle('jorge;drop')).toBe(false);
  });
});
