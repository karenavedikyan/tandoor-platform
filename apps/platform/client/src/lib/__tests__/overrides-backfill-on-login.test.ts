/**
 * Запуск: npm run test:overrides-backfill-on-login
 */
import assert from "node:assert/strict";

const store = new Map<string, string>();
const ls = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
  clear: () => store.clear(),
};
// @ts-expect-error test shim
globalThis.localStorage = ls;
// @ts-expect-error test shim
globalThis.window = { localStorage: ls, dispatchEvent: () => true, addEventListener: () => undefined, removeEventListener: () => undefined };

const { OVERRIDES_BACKFILL_DONE_KEY, runOverridesBackfillIfNeeded } = await import(
  "../overrides-backfill-on-login.js"
);
const { listPendingSyncItems } = await import("../overrides-pending-sync.js");

store.clear();
store.set(OVERRIDES_BACKFILL_DONE_KEY, "1");
await runOverridesBackfillIfNeeded("user-skip");
assert.equal(listPendingSyncItems().length, 0, "skips when done flag set");

console.log("✓ overrides-backfill-on-login tests passed");
