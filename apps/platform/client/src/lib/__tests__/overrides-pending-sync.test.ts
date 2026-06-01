/**
 * Запуск: npm run test:overrides-pending-sync
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

const {
  dequeuePendingSync,
  enqueuePendingSync,
  listPendingSyncItems,
  markPendingSyncDead,
  markPendingSyncFailed,
  OVERRIDES_PENDING_STORAGE_KEY,
  pendingSyncCount,
  removePendingSyncWithUuidErrors,
} = await import("../overrides-pending-sync.js");

store.clear();

enqueuePendingSync({
  id: "dealer-upsert:D1",
  kind: "dealer-upsert",
  payload: { dealer_id: "D1", fields: { name: "A" } },
});
assert.equal(pendingSyncCount(), 1, "enqueue increases count");

dequeuePendingSync("dealer-upsert:D1");
assert.equal(listPendingSyncItems().length, 0, "dequeue clears item");

enqueuePendingSync({
  id: "tp-upsert:T1",
  kind: "tp-upsert",
  payload: { tp_id: "T1" },
});
markPendingSyncFailed("tp-upsert:T1", "HTTP 503");
const item = listPendingSyncItems()[0];
assert.equal(item?.attempts, 1, "markFailed increments attempts");
assert.equal(item?.lastError, "HTTP 503");
assert.ok(localStorageMock.getItem(OVERRIDES_PENDING_STORAGE_KEY)?.includes("HTTP 503"));

enqueuePendingSync({
  id: "dealer-upsert:bad",
  kind: "dealer-upsert",
  payload: { dealer_id: "D2", fields: { regional_manager_id: "mgr-bad" } },
  lastError: "invalid input syntax for type uuid: mgr-bad",
});
assert.equal(removePendingSyncWithUuidErrors(), 1);
assert.equal(pendingSyncCount(), 1, "only active non-uuid item remains");

markPendingSyncDead("tp-upsert:T1", "INVALID_UUID_FIELD");
assert.equal(listPendingSyncItems().length, 0, "dead items excluded from active list");

console.log("✓ overrides-pending-sync tests passed");
