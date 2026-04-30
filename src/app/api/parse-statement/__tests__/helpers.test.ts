import { describe, it, expect, vi } from 'vitest';

// stub out heavy dependencies the route imports at module level
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: vi.fn() } };
  },
}));

import { splitIntoChunks, parseJSON } from '../route';

describe('splitIntoChunks', () => {
  it('returns single chunk when content fits within limit', () => {
    const content = 'line1\nline2\nline3';
    const chunks = splitIntoChunks(content, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(content);
  });

  it('splits content into multiple chunks at newline boundaries', () => {
    const line = 'a'.repeat(100) + '\n';
    const content = line.repeat(10);
    const chunks = splitIntoChunks(content, 350);
    expect(chunks.length).toBeGreaterThan(1);
    const rejoined = chunks.join('');
    expect(rejoined).toBe(content);
  });

  it('each chunk does not exceed maxChars (with newline boundary caveat)', () => {
    const line = 'x'.repeat(50) + '\n';
    const content = line.repeat(20);
    const chunks = splitIntoChunks(content, 200);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200 + 50);
    }
  });

  it('handles content without newlines by hard-cutting at maxChars', () => {
    const content = 'a'.repeat(500);
    const chunks = splitIntoChunks(content, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  it('preserves all content across all chunks', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `row-${i},data-${i}`);
    const content = lines.join('\n');
    const chunks = splitIntoChunks(content, 100);
    expect(chunks.join('')).toBe(content);
  });
});

describe('parseJSON', () => {
  it('parses clean JSON array', () => {
    const raw = '[{"type":"income","amount":100}]';
    const result = parseJSON(raw);
    expect(result).toEqual([{ type: 'income', amount: 100 }]);
  });

  it('strips markdown json code block', () => {
    const raw = '```json\n[{"a":1}]\n```';
    const result = parseJSON(raw);
    expect(result).toEqual([{ a: 1 }]);
  });

  it('strips plain markdown code block', () => {
    const raw = '```\n[{"b":2}]\n```';
    const result = parseJSON(raw);
    expect(result).toEqual([{ b: 2 }]);
  });

  it('returns empty array for empty JSON array', () => {
    expect(parseJSON('[]')).toEqual([]);
  });

  it('throws on completely invalid JSON', () => {
    expect(() => parseJSON('not json at all')).toThrow();
  });

  it('recovers from trailing garbage after last closing brace', () => {
    const raw = '[{"type":"expense","amount":200}trailing garbage';
    expect(() => parseJSON(raw)).not.toThrow();
    const result = parseJSON(raw);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles whitespace-padded input', () => {
    const raw = '  \n  [{"x":42}]  \n  ';
    const result = parseJSON(raw);
    expect(result).toEqual([{ x: 42 }]);
  });
});
