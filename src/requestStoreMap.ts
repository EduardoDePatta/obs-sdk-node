import type { RequestStore } from './context';

const stores = new WeakMap<object, RequestStore>();

export function setRequestStore(request: object, store: RequestStore): void {
  stores.set(request, store);
}

export function getMappedRequestStore(
  request: object,
): RequestStore | undefined {
  return stores.get(request);
}

export default {
  setRequestStore,
  getMappedRequestStore,
};
