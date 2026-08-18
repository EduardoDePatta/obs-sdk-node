import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import IngestBatch, { type FetchLike } from '../src/batch';
import type { IngestPayload, IngestRequest } from '../src/types';

function makeRequest(path: string): IngestRequest {
  return {
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'GET',
    path,
    routePattern: path,
    statusCode: 200,
    durationMs: 3,
    service: 'demo',
    env: 'test',
  };
}

function createBatch({
  fetch,
  maxQueue = 8,
  flushSize = 100,
  onDrop = function noopDrop(_reason: string): void {
    return;
  },
}: {
  fetch: FetchLike;
  maxQueue?: number;
  flushSize?: number;
  onDrop?: (reason: string) => void;
}): IngestBatch {
  return new IngestBatch({
    ingestUrl: 'http://obs.test/v1/ingest',
    writeKey: 'ok_write_test_secret',
    maxQueue,
    flushSize,
    flushIntervalMs: 0,
    retryDelaysMs: [0, 0],
    fetchTimeoutMs: 50,
    fetch,
    onDrop,
  });
}

describe('IngestBatch', () => {
  test('flush posts the ingest contract shape', async () => {
    const bodies: IngestPayload[] = [];
    async function captureFetch(
      _url: string,
      init: { body: string },
    ): Promise<{ status: number }> {
      bodies.push(JSON.parse(init.body) as IngestPayload);
      return { status: 202 };
    }

    const batch = createBatch({ fetch: captureFetch });
    const request = makeRequest('/health');
    batch.enqueue(request);
    await batch.flush();

    expect(bodies).toHaveLength(1);
    const payload = bodies[0];
    expect(payload).toEqual({
      requests: [request],
    });
    expect(payload?.requests[0]?.requestId).toEqual(expect.any(String));
  });

  test('queue never grows past maxQueue', async () => {
    const bodies: IngestPayload[] = [];
    async function captureFetch(
      _url: string,
      init: { body: string },
    ): Promise<{ status: number }> {
      bodies.push(JSON.parse(init.body) as IngestPayload);
      return { status: 202 };
    }

    const batch = createBatch({
      fetch: captureFetch,
      maxQueue: 2,
      flushSize: 100,
    });
    batch.enqueue(makeRequest('/a'));
    batch.enqueue(makeRequest('/b'));
    batch.enqueue(makeRequest('/c'));
    batch.enqueue(makeRequest('/d'));

    expect(batch.size()).toBe(2);

    await batch.flush();
    const sent = bodies[0]?.requests.map(item => item.path);
    expect(sent).toEqual(['/c', '/d']);
  });

  test('network errors drop after retries without throwing', async () => {
    const drops: string[] = [];
    async function failingFetch(): Promise<{ status: number }> {
      throw new Error('down');
    }

    function captureDrop(reason: string): void {
      drops.push(reason);
    }

    const batch = createBatch({
      fetch: failingFetch,
      onDrop: captureDrop,
    });
    batch.enqueue(makeRequest('/x'));
    await expect(batch.flush()).resolves.toBeUndefined();
    expect(drops).toEqual(['retry_exhausted']);
  });

  test('401 drops without retrying', async () => {
    let calls = 0;
    const drops: string[] = [];
    async function unauthorizedFetch(): Promise<{ status: number }> {
      calls += 1;
      return { status: 401 };
    }

    function captureDrop(reason: string): void {
      drops.push(reason);
    }

    const batch = createBatch({
      fetch: unauthorizedFetch,
      onDrop: captureDrop,
    });
    batch.enqueue(makeRequest('/x'));
    await batch.flush();
    expect(calls).toBe(1);
    expect(drops).toEqual(['invalid_response']);
  });
});
