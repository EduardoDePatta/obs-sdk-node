import { describe, expect, test } from 'vitest';

import truncateField from '../src/truncate';

describe('truncateField', () => {
  test('returns the original string when under the byte cap', () => {
    expect(truncateField({ value: 'hello', maxBytes: 100 })).toBe('hello');
  });

  test('cuts utf8 at the byte cap', () => {
    const value = 'é'.repeat(20);
    const truncated = truncateField({ value, maxBytes: 5 });
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(5);
  });

  test('does not split a codepoint in the middle', () => {
    const truncated = truncateField({ value: 'é', maxBytes: 1 });
    expect(truncated).toBe('');
    expect(Buffer.byteLength(truncated, 'utf8')).toBe(0);
  });

  test('returns empty when maxBytes is zero', () => {
    expect(truncateField({ value: 'ab', maxBytes: 0 })).toBe('');
  });
});
