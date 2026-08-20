import Fastify from 'fastify';
import { describe, expect, test } from 'vitest';

import createClient from '../src/client';
import fastifyMiddleware from '../src/fastifyMiddleware';
import type { IngestPayload } from '../src/types';

describe('fastifyMiddleware', () => {
  test('skips ingest and health and captures other routes', async () => {
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
      service: 'obs-api',
      env: 'test',
      flushIntervalMs: 0,
      fetch: captureFetch,
    });

    const app = Fastify();
    fastifyMiddleware(app, client, {
      skip(request) {
        return (
          request.url === '/health' || request.url.startsWith('/v1/ingest')
        );
      },
    });
    app.get('/health', async function health() {
      return { ok: true };
    });
    app.get('/v1/me', async function me() {
      return { email: 'a@b.c' };
    });

    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/v1/me' });
    await client.flush();

    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.requests[0]?.path).toBe('/v1/me');
    expect(bodies[0]?.requests[0]?.service).toBe('obs-api');
    expect(bodies[0]?.requests[0]?.responseBodyJson).toContain('a@b.c');

    client.close();
    await app.close();
  });

  test('authorization is redacted', async () => {
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
      service: 'obs-api',
      env: 'test',
      flushIntervalMs: 0,
      fetch: captureFetch,
    });

    const app = Fastify();
    fastifyMiddleware(app, client);
    app.post('/v1/early-access', async function early() {
      return { ok: true };
    });

    await app.inject({
      method: 'POST',
      url: '/v1/early-access',
      headers: { authorization: 'Bearer super-secret' },
      payload: { email: 'a@b.c', password: 'hunter2' },
    });
    await client.flush();

    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.includes('super-secret')).toBe(false);
    expect(bodies[0]?.includes('hunter2')).toBe(false);

    client.close();
    await app.close();
  });

  test('middleware redactKeys redacts extra body fields', async () => {
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
      service: 'obs-api',
      env: 'test',
      flushIntervalMs: 0,
      fetch: captureFetch,
    });

    const app = Fastify();
    fastifyMiddleware(app, client, {
      redactKeys: ['email'],
    });
    app.post('/v1/leads', async function lead() {
      return { ok: true };
    });

    await app.inject({
      method: 'POST',
      url: '/v1/leads',
      payload: { email: 'ada@example.com', sku: 'abc' },
    });
    await client.flush();

    const requestBody = bodies[0]?.requests[0]?.requestBodyJson ?? '';
    expect(requestBody.includes('ada@example.com')).toBe(false);
    expect(requestBody.includes('abc')).toBe(true);
    expect(requestBody).toContain('[redacted]');

    client.close();
    await app.close();
  });
});
