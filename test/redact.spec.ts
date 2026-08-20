import { describe, expect, test } from 'vitest';

import { REDACTED } from '../src/config';
import mergeRedactKeys from '../src/mergeRedactKeys';
import { redactBody, redactHeaders } from '../src/redact';
import truncateField from '../src/truncate';

describe('redact', () => {
  test('replaces authorization in headers', () => {
    const output = redactHeaders({
      headers: {
        Authorization: 'Bearer secret-token',
        Accept: 'application/json',
      },
      extraKeys: [],
    });

    expect(output.Authorization).toBe(REDACTED);
    expect(output.Accept).toBe('application/json');
  });

  test('replaces nested body secrets', () => {
    const output = redactBody({
      value: {
        user: 'ada',
        password: 'hunter2',
        nested: { token: 'abc', ok: true },
      },
      extraKeys: [],
    });

    expect(output).toEqual({
      user: 'ada',
      password: REDACTED,
      nested: { token: REDACTED, ok: true },
    });
  });

  test('replaces extra keys in headers and bodies', () => {
    const headers = redactHeaders({
      headers: {
        Accept: 'application/json',
        'X-Email': 'ada@example.com',
      },
      extraKeys: ['x-email'],
    });
    expect(headers['X-Email']).toBe(REDACTED);
    expect(headers.Accept).toBe('application/json');

    const body = redactBody({
      value: { email: 'ada@example.com', sku: 'abc' },
      extraKeys: ['Email'],
    });
    expect(body).toEqual({ email: REDACTED, sku: 'abc' });
  });
});

describe('mergeRedactKeys', () => {
  test('lowercases, trims, dedupes, and keeps order', () => {
    expect(
      mergeRedactKeys([[' Email ', 'cpf'], ['email', 'ssn'], undefined]),
    ).toEqual(['email', 'cpf', 'ssn']);
  });
});

describe('truncateField', () => {
  test('cuts utf8 at the byte cap', () => {
    const value = 'é'.repeat(20);
    const truncated = truncateField({ value, maxBytes: 5 });
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(5);
  });
});
