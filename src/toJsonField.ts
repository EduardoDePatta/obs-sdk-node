import { redactBody, redactHeaders } from './redact';
import truncateField from './truncate';

function serializeJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

export function toHeadersJson({
  headers,
  maxBytes,
  extraKeys,
}: {
  headers: Record<string, unknown>;
  maxBytes: number;
  extraKeys: string[];
}): string | undefined {
  const json = serializeJson(redactHeaders({ headers, extraKeys }));
  if (json === undefined) {
    return undefined;
  }

  return truncateField({ value: json, maxBytes });
}

export function toBodyJson({
  value,
  maxBytes,
  extraKeys,
}: {
  value: unknown;
  maxBytes: number;
  extraKeys: string[];
}): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const json = serializeJson(redactBody({ value, extraKeys }));
  if (json === undefined) {
    return undefined;
  }

  return truncateField({ value: json, maxBytes });
}

export default toBodyJson;
