import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('allows the first request', () => {
    const result = checkRateLimit('user-rl-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.resetIn).toBe(0);
  });

  it('decrements remaining with each call', () => {
    const userId = 'user-rl-2';
    for (let i = 0; i < 5; i++) {
      checkRateLimit(userId);
    }
    const result = checkRateLimit(userId);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks after 10 requests', () => {
    const userId = 'user-rl-3';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(userId);
    }
    const result = checkRateLimit(userId);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it('resets after the 1-hour window expires', () => {
    const userId = 'user-rl-4';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(userId);
    }

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    const result = checkRateLimit(userId);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('tracks users independently', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit('user-rl-5a');
    }
    const blocked = checkRateLimit('user-rl-5a');
    const free = checkRateLimit('user-rl-5b');

    expect(blocked.allowed).toBe(false);
    expect(free.allowed).toBe(true);
  });

  it('provides correct resetIn value', () => {
    const userId = 'user-rl-6';
    for (let i = 0; i < 10; i++) {
      checkRateLimit(userId);
    }
    const result = checkRateLimit(userId);
    expect(result.resetIn).toBeLessThanOrEqual(3600);
    expect(result.resetIn).toBeGreaterThan(0);
  });
});
