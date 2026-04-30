import { describe, it, expect } from 'vitest';
import { CATEGORIES } from '../constants';

describe('CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
  });

  it('contains only unique string values', () => {
    const set = new Set(CATEGORIES);
    expect(set.size).toBe(CATEGORIES.length);
    for (const c of CATEGORIES) {
      expect(typeof c).toBe('string');
      expect(c.length).toBeGreaterThan(0);
    }
  });

  it('includes expected core categories', () => {
    expect(CATEGORIES).toContain('Food & Delivery');
    expect(CATEGORIES).toContain('Transportation');
    expect(CATEGORIES).toContain('Entertainment');
    expect(CATEGORIES).toContain('Other');
  });
});
