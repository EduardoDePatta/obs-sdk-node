import type { IncomingHttpHeaders } from 'node:http';
import type { NextFunction, Request, Response } from 'express';

import { MAX_TAGS_PER_REQUEST } from './config';
import type { ObsClient } from './client';
import { bindStore, createStore, type RequestStore } from './context';
import { toBodyJson, toHeadersJson } from './toJsonField';
import type { IngestRequest } from './types';

export type ExpressMiddlewareOptions = {
  resolveTags?: (req: Request) => Record<string, string> | undefined;
  resolveUserId?: (req: Request) => string | undefined;
};

function headersAsRecord(
  headers: IncomingHttpHeaders,
): Record<string, unknown> {
  return { ...headers };
}

function resolvePath(req: Request): string {
  if (typeof req.originalUrl === 'string' && req.originalUrl !== '') {
    return req.originalUrl;
  }

  if (typeof req.url === 'string' && req.url !== '') {
    return req.url;
  }

  return '/';
}

function resolveRoutePattern(req: Request): string {
  const route = req.route as { path?: unknown } | undefined;
  if (
    route !== undefined &&
    typeof route.path === 'string' &&
    route.path !== ''
  ) {
    return route.path;
  }

  return resolvePath(req);
}

function resolveIp(req: Request): string | undefined {
  if (typeof req.ip === 'string' && req.ip !== '') {
    return req.ip;
  }

  const remote = req.socket.remoteAddress;
  if (typeof remote === 'string' && remote !== '') {
    return remote;
  }

  return undefined;
}

function resolveUserAgent(req: Request): string | undefined {
  const value = req.headers['user-agent'];
  if (typeof value !== 'string' || value === '') {
    return undefined;
  }

  return value;
}

function capTags(
  tags: Record<string, string>,
): Record<string, string> | undefined {
  const entries = Object.entries(tags);
  if (entries.length === 0) {
    return undefined;
  }

  const capped = Object.fromEntries(entries.slice(0, MAX_TAGS_PER_REQUEST));
  return capped;
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

function wrapResponse({
  res,
  store,
}: {
  res: Response;
  store: RequestStore;
}): void {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = ((body?: unknown) => {
    if (body !== undefined) {
      store.responseBody = body;
    }
    return originalJson(body);
  }) as Response['json'];

  res.send = ((body?: unknown) => {
    if (body !== undefined) {
      store.responseBody = body;
    }
    return originalSend(body);
  }) as Response['send'];
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

function buildRequest({
  req,
  res,
  store,
  client,
  options,
}: {
  req: Request;
  res: Response;
  store: RequestStore;
  client: ObsClient;
  options: ExpressMiddlewareOptions | undefined;
}): IngestRequest {
  const finishedAt = Date.now();
  const durationMs = Math.max(0, finishedAt - store.startedAt.getTime());
  const maxBytes = client.maxBodyBytes;

  let extraTags: Record<string, string> | undefined;
  if (options !== undefined && options.resolveTags !== undefined) {
    extraTags = options.resolveTags(req);
  }

  let userId: string | undefined;
  if (options !== undefined && options.resolveUserId !== undefined) {
    userId = options.resolveUserId(req);
  }

  const request: IngestRequest = {
    requestId: store.requestId,
    timestamp: store.startedAt.toISOString(),
    method: req.method,
    path: resolvePath(req),
    routePattern: resolveRoutePattern(req),
    statusCode: res.statusCode,
    durationMs,
    service: client.service,
    env: client.env,
  };

  const tags = mergeTags({ store, extra: extraTags });
  if (tags !== undefined) {
    request.tags = tags;
  }

  assignOptionalString({ target: request, key: 'userId', value: userId });
  assignOptionalString({ target: request, key: 'ip', value: resolveIp(req) });
  assignOptionalString({
    target: request,
    key: 'userAgent',
    value: resolveUserAgent(req),
  });
  assignOptionalString({
    target: request,
    key: 'errorMessage',
    value: store.errorMessage,
  });
  assignOptionalString({
    target: request,
    key: 'queryJson',
    value: toBodyJson({ value: req.query, maxBytes }),
  });
  assignOptionalString({
    target: request,
    key: 'requestHeadersJson',
    value: toHeadersJson({
      headers: headersAsRecord(req.headers),
      maxBytes,
    }),
  });
  assignOptionalString({
    target: request,
    key: 'requestBodyJson',
    value: toBodyJson({ value: req.body, maxBytes }),
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

export default function expressMiddleware(
  client: ObsClient,
  options?: ExpressMiddlewareOptions,
) {
  return function obsExpressMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const store = createStore();
    bindStore(store);
    wrapResponse({ res, store });

    res.on('finish', () => {
      try {
        const request = buildRequest({
          req,
          res,
          store,
          client,
          options,
        });
        client.enqueue(request);
      } catch {
        return;
      }
    });

    next();
  };
}
