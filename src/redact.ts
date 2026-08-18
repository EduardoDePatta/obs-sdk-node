import { REDACT_BODY_KEYS, REDACT_HEADER_KEYS, REDACTED } from './config';

const MAX_DEPTH = 8;

function isSensitiveKey({
  key,
  keys,
}: {
  key: string;
  keys: Record<string, true>;
}): boolean {
  return keys[key.toLowerCase()] === true;
}

export function redactRecord({
  input,
  keys,
}: {
  input: Record<string, unknown>;
  keys: Record<string, true>;
}): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveKey({ key, keys })) {
      output[key] = REDACTED;
      continue;
    }

    output[key] = redactValue({ value, keys, depth: 1 });
  }

  return output;
}

function redactValue({
  value,
  keys,
  depth,
}: {
  value: unknown;
  keys: Record<string, true>;
  depth: number;
}): unknown {
  if (depth > MAX_DEPTH) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item =>
      redactValue({ value: item, keys, depth: depth + 1 }),
    );
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  return redactRecord({
    input: value as Record<string, unknown>,
    keys,
  });
}

export function redactHeaders(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return redactRecord({ input, keys: REDACT_HEADER_KEYS });
}

export function redactBody(value: unknown): unknown {
  return redactValue({ value, keys: REDACT_BODY_KEYS, depth: 0 });
}

export default redactHeaders;
