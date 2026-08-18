export type EventLevel = 'info' | 'warn' | 'error';

export type IngestEvent = {
  seq: number;
  timestamp: string;
  name: string;
  level: EventLevel;
  durationMs?: number;
  attrs?: Record<string, string>;
};

export type IngestRequest = {
  requestId: string;
  timestamp: string;
  method: string;
  path: string;
  routePattern: string;
  statusCode: number;
  durationMs: number;
  service: string;
  env: string;
  tags?: Record<string, string>;
  userId?: string;
  ip?: string;
  userAgent?: string;
  errorMessage?: string;
  queryJson?: string;
  requestHeadersJson?: string;
  requestBodyJson?: string;
  responseBodyJson?: string;
  events?: IngestEvent[];
};

export type IngestPayload = {
  requests: IngestRequest[];
};

export type StepOptions = {
  level?: EventLevel;
  durationMs?: number;
};
