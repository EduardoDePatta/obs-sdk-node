import { describe, expect, test } from 'vitest';

import {
  createClient,
  expressMiddleware,
  fastifyMiddleware,
} from '../src/index';

describe('package exports', () => {
  test('exposes createClient and both middlewares', () => {
    expect(typeof createClient).toBe('function');
    expect(typeof expressMiddleware).toBe('function');
    expect(typeof fastifyMiddleware).toBe('function');
  });
});
