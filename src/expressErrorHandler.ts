import type { NextFunction, Request, Response } from 'express';

import type { ObsClient } from './client';
import { getStore } from './context';
import recordUnhandledError from './recordUnhandledError';
import { getMappedRequestStore } from './requestStoreMap';

export default function expressErrorHandler(
  client: ObsClient,
): (err: unknown, req: Request, res: Response, next: NextFunction) => void {
  void client;

  return function obsExpressErrorHandler(
    err: unknown,
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    try {
      const store = getStore() ?? getMappedRequestStore(req);
      if (store !== undefined) {
        recordUnhandledError({ store, err });
      }
    } catch {
      next(err);
      return;
    }

    next(err);
  };
}
