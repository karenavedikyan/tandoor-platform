/**
 * Запуск: npm run test:showcase-matrix-store
 */
import assert from "node:assert/strict";

const store = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

// @ts-expect-error test shim
globalThis.localStorage = localStorageMock;
// @ts-expect-error test shim
globalThis.window = {
  localStorage: localStorageMock,
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

Object.defineProperty(globalThis, "crypto", {
  value: { randomUUID: () => "test-op-uuid-0001" },
  configurable: true,
});

const {
  showcaseMatrixCacheKey,
  loadCachedMatrix,
  setMatrixStatus,
  SHOWCASE_MATRIX_STORE_CACHE_KEY,
} = await import("../showcase-matrix-store.js");

const { listPendingSyncItems, OVERRIDES_PENDING_STORAGE_KEY } = await import("../overrides-pending-sync.js");

store.clear();
localStorageMock.removeItem(OVERRIDES_PENDING_STORAGE_KEY);
localStorageMock.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);

assert.equal(showcaseMatrixCacheKey("tp-1", "model", "m-42"), "tp-1|model|m-42");

setMatrixStatus({
  dealerId: "d-1",
  tradePointId: "tp-1",
  targetKind: "model",
  targetId: "m-42",
  status: "need_install",
  comment: "test",
  updatedBy: "user-1",
  updatedByName: "Tester",
});

const cached = loadCachedMatrix("tp-1");
assert.equal(cached.length, 1);
assert.equal(cached[0]?.status, "need_install");
assert.equal(cached[0]?.targetId, "m-42");
assert.equal(cached[0]?.updatedByName, "Tester");

const rawCache = localStorageMock.getItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
assert.ok(rawCache?.includes("tp-1|model|m-42"));

const pending = listPendingSyncItems();
assert.equal(pending.length, 1);
assert.equal(pending[0]?.kind, "showcase-matrix-upsert");
assert.equal(pending[0]?.id, "showcase-matrix-upsert:test-op-uuid-0001");

const payload = pending[0]?.payload as Record<string, unknown>;
assert.equal(payload.dealerId, "d-1");
assert.equal(payload.tradePointId, "tp-1");
assert.equal(payload.clientOpId, "test-op-uuid-0001");

console.log("✓ showcase-matrix-store tests passed");
