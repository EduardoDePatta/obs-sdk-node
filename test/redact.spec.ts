import { describe, expect, test } from 'vitest';

import { REDACTED } from '../src/config';
import { redactBody, redactHeaders } from '../src/redact';
import truncateField from '../src/truncate';

describe('redact', () => {
  test('replaces authorization in headers', () => {
    const output = redactHeaders({
      Authorization: 'Bearer secret-token',
      Accept: 'application/json',
    });

    expect(output.Authorization).toBe(REDACTED);
    expect(output.Accept).toBe('application/json');
  });

  test('replaces nested body secrets', () => {
    const output = redactBody({
      user: 'ada',
      password: 'hunter2',
      nested: { token: 'abc', ok: true },
    });

    expect(output).toEqual({
      user: 'ada',
      password: REDACTED,
      nested: { token: REDACTED, ok: true },
    });
  });
});

describe('truncateField', () => {
  test('cuts utf8 at the byte cap', () => {
    const value = 'é'.repeat(20);
    const truncated = truncateField({ value, maxBytes: 5 });
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(5);
  });
});
