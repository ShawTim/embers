// Vitest setup — provide a localStorage polyfill for the node environment.
// The save/load system + i18n language preference both rely on
// localStorage.  A trivial in-memory shim is enough for the unit tests.

const memStore = new Map<string, string>();
const localStoragePolyfill: Storage = {
  get length() { return memStore.size; },
  clear() { memStore.clear(); },
  getItem(k: string) { return memStore.has(k) ? memStore.get(k)! : null; },
  key(i: number) { return Array.from(memStore.keys())[i] ?? null; },
  removeItem(k: string) { memStore.delete(k); },
  setItem(k: string, v: string) { memStore.set(k, v); },
};

(globalThis as any).localStorage = localStoragePolyfill;
