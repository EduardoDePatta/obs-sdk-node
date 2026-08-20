import { EventEmitter } from 'node:events';

import type { Request, Response } from 'express';
import { describe, expect, test } from 'vitest';

import createClient from '../src/client';
import { createStore, runWith } from '../src/context';
import expressMiddleware from '../src/expressMiddleware';
import type { IngestPayload } from '../src/types';

function createRes(): Response {
  const emitter = new EventEmitter();
  const res = emitter as unknown as Response & EventEmitter;
  res.statusCode = 200;
  res.json = ((body?: unknown) => {
    const payload = JSON.stringify(body);
    res.send(payload);
    return res;
  }) as Response['json'];
  res.send = ((body?: unknown) => {
    void body;
    return res;
  }) as Response['send'];
  return res;
}

function createReq(): Request {
  return {
    method: 'GET',
    originalUrl: '/v1/orders?limit=1',
    url: '/v1/orders?limit=1',
    route: { path: '/v1/orders' },
    headers: {
      authorization: 'Bearer super-secret',
      'user-agent': 'vitest',
    },
    body: { password: 'hunter2', sku: 'abc' },
    query: { limit: '1' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

describe('expressMiddleware', () => {
  test('ingest down still calls next and finish does not throw', async () => {
    async function failingFetch(): Promise<{ status: number }> {
      throw new Error('down');
    }

    function ignoreDrop(): void {
      return;
    }

    const client = createClient({
      ingestUrl: 'http://obs.test/v1/ingest',
      writeKey: 'ok_write_test_secret',
      service: 'demo',
      env: 'test',
      flushIntervalMs: 0,
      retryDelaysMs: [0, 0],
      fetch: failingFetch,
      onDrop: ignoreDrop,
    });
    const middleware = expressMiddleware(client);
    const req = createReq();
    const res = createRes();
    let nextCalls = 0;
    function next(): void {
      nextCalls += 1;
    }

    expect(() => {
      middleware(req, res, next);
    }).not.toThrow();
    expect(nextCalls).toBe(1);

    expect(() => {
      res.emit('finish');
    }).not.toThrow();

    await expect(client.flush()).resolves.toBeUndefined();
    client.close();
  });

  test('authorization never appears in the posted json', async () => {
    const bodies: string[] = [];
    async function captureFetch(
      _url: string,
      init: { body: string },
    ): Promise<{ status: number }> {
      bodies.push(init.body);
      return { status: 202 };
    }

    function resolveTags(): Record<string, string> {
      return { city: '6' };
    }

    const client = createClient({
      ingestUrl: 'http://obs.test/v1/ingest',
      writeKey: 'ok_write_test_secret',
      service: 'demo',
      env: 'test',
      flushIntervalMs: 0,
      fetch: captureFetch,
    });
    const middleware = expressMiddleware(client, {
      resolveTags,
    });
    const req = createReq();
    const res = createRes();

    function noopNext(): void {
      return;
    }

    middleware(req, res, noopNext);
    res.json({ ok: true });
    res.emit('finish');
    await client.flush();

    expect(bodies).toHaveLength(1);
    const raw = bodies[0];
    expect(raw).toBeDefined();
    expect(raw?.includes('super-secret')).toBe(false);
    expect(raw?.includes('hunter2')).toBe(false);
    expect(raw?.toLowerCase().includes('bearer super-secret')).toBe(false);

    const payload = JSON.parse(raw ?? '') as IngestPayload;
    const request = payload.requests[0];
    expect(request?.service).toBe('demo');
    expect(request?.env).toBe('test');
    expect(request?.routePattern).toBe('/v1/orders');
    expect(request?.tags).toEqual({ city: '6' });
    expect(request?.requestHeadersJson).toContain('[redacted]');
    expect(request?.requestBodyJson).toContain('[redacted]');
    expect(request?.requestBodyJson).toContain('abc');
    expect(request?.responseBodyJson).toBe('{"ok":true}');
    client.close();
  });

  test('redactKeys on the client, middleware, request, and obs.redact all apply', async () => {
    const bodies: string[] = [];
    async function captureFetch(
      _url: string,
      init: { body: string },
    ): Promise<{ status: number }> {
      bodies.push(init.body);
      return { status: 202 };
    }

    const client = createClient({
      ingestUrl: 'http://obs.test/v1/ingest',
      writeKey: 'ok_write_test_secret',
      service: 'demo',
      env: 'test',
      flushIntervalMs: 0,
      fetch: captureFetch,
      redactKeys: ['email'],
    });
    const middleware = expressMiddleware(client, {
      redactKeys: ['cpf'],
      resolveRedactKeys(req) {
        return [String(req.headers['x-redact'] ?? '')];
      },
    });
    const req = createReq();
    req.headers['x-redact'] = 'phone';
    req.body = {
      email: 'ada@example.com',
      cpf: '123',
      phone: '999',
      ssn: '000',
      sku: 'abc',
    };
    const res = createRes();

    function next(): void {
      client.redact(['ssn']);
    }

    middleware(req, res, next);
    res.emit('finish');
    await client.flush();

    const payload = JSON.parse(bodies[0] ?? '') as IngestPayload;
    const requestBody = payload.requests[0]?.requestBodyJson ?? '';
    expect(requestBody.includes('ada@example.com')).toBe(false);
    expect(requestBody.includes('"123"')).toBe(false);
    expect(requestBody.includes('999')).toBe(false);
    expect(requestBody.includes('000')).toBe(false);
    expect(requestBody.includes('abc')).toBe(true);
    expect(requestBody).toContain('[redacted]');
    client.close();
  });

  test('step inside a bound store is included in the batch', async () => {
    const bodies: IngestPayload[] = [];
    async function captureFetch(
      _url: string,
      init: { body: string },
    ): Promise<{ status: number }> {
      bodies.push(JSON.parse(init.body) as IngestPayload);
      return { status: 202 };
    }

    const client = createClient({
      ingestUrl: 'http://obs.test/v1/ingest',
      writeKey: 'ok_write_test_secret',
      service: 'demo',
      env: 'test',
      flushIntervalMs: 0,
      fetch: captureFetch,
    });
    const middleware = expressMiddleware(client);
    const req = createReq();
    const res = createRes();

    function next(): void {
      client.step('handler');
    }

    middleware(req, res, next);
    res.emit('finish');
    await client.flush();

    expect(bodies[0]?.requests[0]?.events).toEqual([
      expect.objectContaining({ name: 'handler', seq: 0, level: 'info' }),
    ]);
    client.close();
  });
});

describe('createClient', () => {
  test('exposes step as a no-op when no store is bound', () => {
    async function okFetch(): Promise<{ status: number }> {
      return { status: 202 };
    }

    const client = createClient({
      ingestUrl: 'http://obs.test/v1/ingest',
      writeKey: 'ok_write_test_secret',
      service: 'demo',
      env: 'test',
      flushIntervalMs: 0,
      fetch: okFetch,
    });

    client.step('orphan');
    expect(client.requestId()).toBeUndefined();
    client.close();
  });

  test('step records when a store is active', () => {
    async function okFetch(): Promise<{ status: number }> {
      return { status: 202 };
    }

    const client = createClient({
      ingestUrl: 'http://obs.test/v1/ingest',
      writeKey: 'ok_write_test_secret',
      service: 'demo',
      env: 'test',
      flushIntervalMs: 0,
      fetch: okFetch,
    });
    const store = createStore();
    runWith(store, () => {
      client.step('inside');
    });
    expect(store.events).toHaveLength(1);
    client.close();
  });
});
