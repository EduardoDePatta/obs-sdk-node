import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { MAX_EVENTS_PER_REQUEST } from './config';
import type { EventLevel, IngestEvent, StepOptions } from './types';

export type RequestStore = {
  requestId: string;
  startedAt: Date;
  events: IngestEvent[];
  tags: Record<string, string>;
  errorMessage?: string;
  responseBody?: unknown;
};

const storage = new AsyncLocalStorage<RequestStore>();

export function createStore(): RequestStore {
  return {
    requestId: randomUUID(),
    startedAt: new Date(),
    events: [],
    tags: {},
  };
}

export function runWith<T>(store: RequestStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function bindStore(store: RequestStore): void {
  storage.enterWith(store);
}

export function getStore(): RequestStore | undefined {
  return storage.getStore();
}

function resolveLevel(options: StepOptions | undefined): EventLevel {
  if (options === undefined || options.level === undefined) {
    return 'info';
  }

  return options.level;
}

export function step(
  name: string,
  attrs?: Record<string, string>,
  options?: StepOptions,
): void {
  const store = storage.getStore();
  if (store === undefined) {
    return;
  }

  if (store.events.length >= MAX_EVENTS_PER_REQUEST) {
    return;
  }

  const event: IngestEvent = {
    seq: store.events.length,
    timestamp: new Date().toISOString(),
    name,
    level: resolveLevel(options),
  };

  if (options !== undefined && options.durationMs !== undefined) {
    event.durationMs = options.durationMs;
  }

  if (attrs !== undefined) {
    event.attrs = attrs;
  }

  store.events.push(event);
}

export function requestId(): string | undefined {
  const store = storage.getStore();
  if (store === undefined) {
    return undefined;
  }

  return store.requestId;
}

export function setTags(tags: Record<string, string>): void {
  const store = storage.getStore();
  if (store === undefined) {
    return;
  }

  store.tags = {
    ...store.tags,
    ...tags,
  };
}

export function setErrorMessage(message: string): void {
  const store = storage.getStore();
  if (store === undefined) {
    return;
  }

  store.errorMessage = message;
}

export function setResponseBody(body: unknown): void {
  const store = storage.getStore();
  if (store === undefined) {
    return;
  }

  store.responseBody = body;
}

export default {
  createStore,
  runWith,
  bindStore,
  getStore,
  step,
  requestId,
  setTags,
  setErrorMessage,
  setResponseBody,
};
