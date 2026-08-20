import { describe, expect, test } from 'vitest';

import { MAX_EVENTS_PER_REQUEST } from '../src/config';
import {
  createStore,
  getStore,
  redact,
  requestId,
  runWith,
  setErrorMessage,
  setResponseBody,
  setTags,
  step,
} from '../src/context';

describe('context', () => {
  test('step is a no-op without a store', () => {
    step('handler');
    expect(requestId()).toBeUndefined();
  });

  test('step records events only inside runWith', () => {
    const store = createStore();

    runWith(store, () => {
      step('db.query', { table: 'users' }, { level: 'info', durationMs: 4 });
      expect(requestId()).toBe(store.requestId);
    });

    expect(store.events).toHaveLength(1);
    const event = store.events[0];
    expect(event).toMatchObject({
      seq: 0,
      name: 'db.query',
      level: 'info',
      durationMs: 4,
      attrs: { table: 'users' },
    });
    expect(event?.timestamp).toEqual(expect.any(String));
  });

  test('setTags is a no-op without a store', () => {
    setTags({ city: '6' });
    const store = createStore();
    expect(store.tags).toEqual({});
  });

  test('redact is a no-op without a store', () => {
    redact(['email']);
    const store = createStore();
    expect(store.redactKeys).toEqual([]);
  });

  test('redact merges extra keys on the store', () => {
    const store = createStore();
    runWith(store, () => {
      redact(['Email']);
      redact(['cpf']);
    });
    expect(store.redactKeys).toEqual(['email', 'cpf']);
  });

  test('getStore returns the active store inside runWith', () => {
    const store = createStore();
    runWith(store, () => {
      expect(getStore()).toBe(store);
    });
    expect(getStore()).toBeUndefined();
  });

  test('step defaults to info when options are omitted', () => {
    const store = createStore();
    runWith(store, () => {
      step('handler');
    });
    expect(store.events[0]?.level).toBe('info');
    expect(store.events[0]?.durationMs).toBeUndefined();
    expect(store.events[0]?.attrs).toBeUndefined();
  });

  test('step stops after the per-request event cap', () => {
    const store = createStore();
    runWith(store, () => {
      for (let i = 0; i < MAX_EVENTS_PER_REQUEST + 5; i += 1) {
        step(`step.${i}`);
      }
    });
    expect(store.events).toHaveLength(MAX_EVENTS_PER_REQUEST);
  });

  test('setTags merges onto existing tags', () => {
    const store = createStore();
    runWith(store, () => {
      setTags({ city: '4' });
      setTags({ tenant: 'acme' });
    });
    expect(store.tags).toEqual({ city: '4', tenant: 'acme' });
  });

  test('setErrorMessage and setResponseBody write to the store', () => {
    const store = createStore();
    runWith(store, () => {
      setErrorMessage('timeout');
      setResponseBody({ ok: false });
    });
    expect(store.errorMessage).toBe('timeout');
    expect(store.responseBody).toEqual({ ok: false });
  });

  test('setErrorMessage and setResponseBody are no-ops without a store', () => {
    setErrorMessage('timeout');
    setResponseBody({ ok: false });
    const store = createStore();
    expect(store.errorMessage).toBeUndefined();
    expect(store.responseBody).toBeUndefined();
  });
});
