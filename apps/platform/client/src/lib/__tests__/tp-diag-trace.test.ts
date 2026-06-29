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

type MockLocation = {
  search: string;
  hash: string;
  href: string;
};

const g = globalThis as typeof globalThis & {
  window?: {
    localStorage: Storage;
    dispatchEvent: (e: Event) => boolean;
    location: MockLocation;
  };
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

function setMockLocation(parts: Partial<MockLocation>): void {
  const search = parts.search ?? "";
  const hash = parts.hash ?? "";
  const href = parts.href ?? `https://lk.tandoor.ru/${search}${hash}`;
  g.window = {
    localStorage: mockLocalStorage as Storage,
    dispatchEvent: () => true,
    location: { search, hash, href },
  };
}

setMockLocation({});
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

// tpdiag=1 в hash — включает и прилипает в localStorage
storage.clear();
setMockLocation({
  search: "",
  hash: "#/dealers/client-ma-ma120571?tpdiag=1",
  href: "https://lk.tandoor.ru/#/dealers/client-ma-ma120571?tpdiag=1",
});
assert.equal(isTpDiagEnabled(), true);
assert.equal(storage.get(TP_DIAG_STORAGE_KEY), "1");

// после «прилипания» параметр в URL не нужен
setMockLocation({
  search: "",
  hash: "#/dealers/client-ma-ma120571",
  href: "https://lk.tandoor.ru/#/dealers/client-ma-ma120571",
});
assert.equal(isTpDiagEnabled(), true);

// tpdiag=0 в href выключает и чистит localStorage
setMockLocation({
  search: "",
  hash: "#/dealers/client-ma-ma120571",
  href: "https://lk.tandoor.ru/?tpdiag=0#/dealers/client-ma-ma120571",
});
assert.equal(isTpDiagEnabled(), false);
assert.equal(storage.has(TP_DIAG_STORAGE_KEY), false);

// tpdiag=1 в search до hash
storage.clear();
setMockLocation({
  search: "?tpdiag=1",
  hash: "#/dealers/client-ma-ma120571",
  href: "https://lk.tandoor.ru/?tpdiag=1#/dealers/client-ma-ma120571",
});
assert.equal(isTpDiagEnabled(), true);
assert.equal(storage.get(TP_DIAG_STORAGE_KEY), "1");

console.log("tp-diag-trace: ok");
