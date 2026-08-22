import { describe, expect, test } from 'vitest';

import {
  createClient,
  expressErrorHandler,
  expressMiddleware,
  fastifyErrorHandler,
  fastifyMiddleware,
} from '../src/index';

describe('package exports', () => {
  test('exposes createClient and both middlewares', () => {
    expect(typeof createClient).toBe('function');
    expect(typeof expressMiddleware).toBe('function');
    expect(typeof fastifyMiddleware).toBe('function');
    expect(typeof expressErrorHandler).toBe('function');
    expect(typeof fastifyErrorHandler).toBe('function');
  });
});
