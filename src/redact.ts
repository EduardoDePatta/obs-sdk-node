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

function keysWithExtras({
  base,
  extraKeys,
}: {
  base: Record<string, true>;
  extraKeys: string[];
}): Record<string, true> {
  const keys: Record<string, true> = { ...base };
  for (const key of extraKeys) {
    const normalized = key.trim().toLowerCase();
    if (normalized === '') {
      continue;
    }

    keys[normalized] = true;
  }

  return keys;
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

export function redactHeaders({
  headers,
  extraKeys,
}: {
  headers: Record<string, unknown>;
  extraKeys: string[];
}): Record<string, unknown> {
  return redactRecord({
    input: headers,
    keys: keysWithExtras({ base: REDACT_HEADER_KEYS, extraKeys }),
  });
}

export function redactBody({
  value,
  extraKeys,
}: {
  value: unknown;
  extraKeys: string[];
}): unknown {
  return redactValue({
    value,
    keys: keysWithExtras({ base: REDACT_BODY_KEYS, extraKeys }),
    depth: 0,
  });
}

export default redactHeaders;
