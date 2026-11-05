import { describe, expect, it } from 'vitest';
import { analyticsId } from './analytics-id.js';

const USER = '6f1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70';
const SECRET = 'a-secret-of-at-least-thirty-two-characters';

describe('analyticsId', () => {
  it('is 32 hexadecimal characters, the same for the same user and secret', () => {
    const id = analyticsId(USER, SECRET);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(analyticsId(USER, SECRET)).toBe(id);
  });

  it('never carries the user id, and changes with the user or the secret', () => {
    const id = analyticsId(USER, SECRET);
    expect(id).not.toContain(USER.replaceAll('-', '').slice(0, 8));
    expect(analyticsId('7a1c2a3e-8b7d-4c1e-9a2f-0d3b4c5e6f70', SECRET)).not.toBe(id);
    expect(analyticsId(USER, `${SECRET}!`)).not.toBe(id);
  });
});
