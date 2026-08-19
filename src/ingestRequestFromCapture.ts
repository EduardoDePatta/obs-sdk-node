import { MAX_TAGS_PER_REQUEST } from './config';
import type { ObsClient } from './client';
import type { RequestStore } from './context';
import { toBodyJson, toHeadersJson } from './toJsonField';
import type { IngestRequest } from './types';

export type CapturedHttp = {
  method: string;
  path: string;
  routePattern: string;
  statusCode: number;
  query: unknown;
  headers: Record<string, unknown>;
  body: unknown;
  ip: string | undefined;
  userAgent: string | undefined;
  extraTags: Record<string, string> | undefined;
  userId: string | undefined;
};

function capTags(
  tags: Record<string, string>,
): Record<string, string> | undefined {
  const entries = Object.entries(tags);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.slice(0, MAX_TAGS_PER_REQUEST));
}

function mergeTags({
  store,
  extra,
}: {
  store: RequestStore;
  extra: Record<string, string> | undefined;
}): Record<string, string> | undefined {
  const merged: Record<string, string> = {
    ...store.tags,
  };

  if (extra !== undefined) {
    Object.assign(merged, extra);
  }

  return capTags(merged);
}

function assignOptionalString({
  target,
  key,
  value,
}: {
  target: IngestRequest;
  key:
    | 'userId'
    | 'ip'
    | 'userAgent'
    | 'errorMessage'
    | 'queryJson'
    | 'requestHeadersJson'
    | 'requestBodyJson'
    | 'responseBodyJson';
  value: string | undefined;
}): void {
  if (value === undefined || value === '') {
    return;
  }

  target[key] = value;
}

export default function ingestRequestFromCapture({
  http,
  store,
  client,
}: {
  http: CapturedHttp;
  store: RequestStore;
  client: ObsClient;
}): IngestRequest {
  const finishedAt = Date.now();
  const durationMs = Math.max(0, finishedAt - store.startedAt.getTime());
  const maxBytes = client.maxBodyBytes;

  const request: IngestRequest = {
    requestId: store.requestId,
    timestamp: store.startedAt.toISOString(),
    method: http.method,
    path: http.path,
    routePattern: http.routePattern,
    statusCode: http.statusCode,
    durationMs,
    service: client.service,
    env: client.env,
  };

  const tags = mergeTags({ store, extra: http.extraTags });
  if (tags !== undefined) {
    request.tags = tags;
  }

  assignOptionalString({ target: request, key: 'userId', value: http.userId });
  assignOptionalString({ target: request, key: 'ip', value: http.ip });
  assignOptionalString({
    target: request,
    key: 'userAgent',
    value: http.userAgent,
  });
  assignOptionalString({
    target: request,
    key: 'errorMessage',
    value: store.errorMessage,
  });
  assignOptionalString({
    target: request,
    key: 'queryJson',
    value: toBodyJson({ value: http.query, maxBytes }),
  });
  assignOptionalString({
    target: request,
    key: 'requestHeadersJson',
    value: toHeadersJson({
      headers: http.headers,
      maxBytes,
    }),
  });
  assignOptionalString({
    target: request,
    key: 'requestBodyJson',
    value: toBodyJson({ value: http.body, maxBytes }),
  });
  assignOptionalString({
    target: request,
    key: 'responseBodyJson',
    value: toBodyJson({ value: store.responseBody, maxBytes }),
  });

  if (store.events.length > 0) {
    request.events = store.events;
  }

  return request;
}
