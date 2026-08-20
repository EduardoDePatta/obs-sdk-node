import { describe, expect, test } from 'vitest';

import { REDACTED } from '../src/config';
import { toBodyJson, toHeadersJson } from '../src/toJsonField';

describe('toHeadersJson', () => {
  test('redacts sensitive headers and returns json', () => {
    const json = toHeadersJson({
      headers: {
        Authorization: 'Bearer secret-token',
        Accept: 'application/json',
      },
      maxBytes: 32 * 1024,
      extraKeys: [],
    });

    expect(json).toBeDefined();
    const parsed = JSON.parse(json ?? '') as Record<string, string>;
    expect(parsed.Authorization).toBe(REDACTED);
    expect(parsed.Accept).toBe('application/json');
  });

  test('truncates when over the byte cap', () => {
    const json = toHeadersJson({
      headers: { Accept: 'x'.repeat(200) },
      maxBytes: 20,
      extraKeys: [],
    });

    expect(json).toBeDefined();
    expect(Buffer.byteLength(json ?? '', 'utf8')).toBeLessThanOrEqual(20);
  });
});

describe('toBodyJson', () => {
  test('returns undefined for undefined value', () => {
    expect(
      toBodyJson({ value: undefined, maxBytes: 100, extraKeys: [] }),
    ).toBeUndefined();
  });

  test('redacts body secrets', () => {
    const json = toBodyJson({
      value: { sku: 'abc', password: 'hunter2' },
      maxBytes: 32 * 1024,
      extraKeys: [],
    });

    expect(json).toBeDefined();
    const parsed = JSON.parse(json ?? '') as Record<string, string>;
    expect(parsed.sku).toBe('abc');
    expect(parsed.password).toBe(REDACTED);
  });

  test('returns undefined when json serialization fails', () => {
    expect(
      toBodyJson({
        value: { n: 1n },
        maxBytes: 1000,
        extraKeys: [],
      }),
    ).toBeUndefined();
  });
});
