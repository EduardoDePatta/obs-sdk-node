import type { ObsClient } from './client';
import { getStore } from './context';
import recordUnhandledError from './recordUnhandledError';
import { getMappedRequestStore } from './requestStoreMap';

type FastifyObsErrorApp = {
  addHook(
    name: 'onError',
    hook: (
      request: object,
      reply: unknown,
      err: unknown,
      done: () => void,
    ) => void,
  ): unknown;
};

export default function fastifyErrorHandler(
  app: object,
  client: ObsClient,
): void {
  void client;

  const hooks = app as FastifyObsErrorApp;
  hooks.addHook('onError', function obsOnError(request, _reply, err, done) {
    try {
      const store = getStore() ?? getMappedRequestStore(request);
      if (store !== undefined) {
        recordUnhandledError({ store, err });
      }
    } catch {
      done();
      return;
    }

    done();
  });
}
