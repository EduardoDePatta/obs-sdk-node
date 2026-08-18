import { describe, expect, test } from 'vitest';

import { createStore, requestId, runWith, setTags, step } from '../src/context';

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
});
