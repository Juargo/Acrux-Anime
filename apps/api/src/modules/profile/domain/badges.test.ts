import { describe, expect, it } from 'vitest';
import { badges } from '../index.js';
import { inCatalogOrder } from './badges.js';

// Probes of the independent verifier of T3 (odd/tasks/insignias.md), kept as regression tests.
describe('badge ids (RF-55)', () => {
  it('accepts an empty list and refuses null, objects, case variants and more than nine', () => {
    expect(badges.safeParse([]).success).toBe(true);
    expect(badges.safeParse(null).success).toBe(false);
    expect(badges.safeParse([{}]).success).toBe(false);
    expect(badges.safeParse(['TITLES_10']).success).toBe(false);
    expect(badges.safeParse(Array(10).fill('titles_10')).success).toBe(false);
  });

  it('drops unknown stored ids and keeps catalog order', () => {
    expect(inCatalogOrder(['genres_10', 'x', 'titles_10'])).toEqual(['titles_10', 'genres_10']);
  });
});
