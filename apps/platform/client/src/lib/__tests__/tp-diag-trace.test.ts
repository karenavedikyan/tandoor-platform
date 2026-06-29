/**
 * Запуск: npx tsx client/src/lib/__tests__/tp-diag-trace.test.ts
 */
import assert from "node:assert/strict";
import {
  clearTpDiag,
  getTpDiag,
  isTpDiagEnabled,
  tpDiag,
  TP_DIAG_STORAGE_KEY,
} from "../tp-diag-trace.js";

const g = globalThis as typeof globalThis & {
  window?: { localStorage: Storage; dispatchEvent: (e: Event) => boolean; location?: { search: string } };
};

const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => {
    storage.set(k, v);
  },
  removeItem: (k: string) => {
    storage.delete(k);
  },
};

g.window = {
  localStorage: mockLocalStorage as Storage,
  dispatchEvent: () => true,
  location: { search: "" },
};

clearTpDiag();
storage.clear();
assert.equal(isTpDiagEnabled(), false);
tpDiag("ignored");
assert.equal(getTpDiag().length, 0);

storage.set(TP_DIAG_STORAGE_KEY, "1");
assert.equal(isTpDiagEnabled(), true);
tpDiag("test:event", { n: 1 });
assert.equal(getTpDiag().length, 1);
assert.equal(getTpDiag()[0]?.tag, "test:event");

clearTpDiag();
assert.equal(getTpDiag().length, 0);

console.log("tp-diag-trace: ok");
