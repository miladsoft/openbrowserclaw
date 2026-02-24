import { describe, it, expect } from 'vitest';
import { ulid } from '../src/ulid.js';

describe('ulid', () => {
  it('returns a 26-character string', () => {
    const id = ulid();
    expect(id).toHaveLength(26);
  });

  it('uses only valid Crockford base32 characters', () => {
    const id = ulid();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => ulid()));
    expect(ids.size).toBe(100);
  });

  it('is monotonically increasing (lexicographic order)', () => {
    const ids = Array.from({ length: 50 }, () => ulid());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('starts with timestamp prefix that changes over time', async () => {
    const id1 = ulid();
    await new Promise((r) => setTimeout(r, 2));
    const id2 = ulid();
    // Time portion (first 10 chars) should differ after a delay
    expect(id2 > id1).toBe(true);
  });
});
