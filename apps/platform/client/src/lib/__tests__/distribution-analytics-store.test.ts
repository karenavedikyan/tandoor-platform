/**
 * Запуск: npm run test:distribution-analytics-store
 */
import assert from "node:assert/strict";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { DistributionScope } from "@/lib/distribution-tree-data";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";

const store = new Map<string, string>();
const eventListeners = new Map<string, Set<(ev?: Event) => void>>();

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
  addEventListener: (name: string, fn: (ev?: Event) => void) => {
    const set = eventListeners.get(name) ?? new Set();
    set.add(fn);
    eventListeners.set(name, set);
  },
  removeEventListener: (name: string, fn: (ev?: Event) => void) => {
    eventListeners.get(name)?.delete(fn);
  },
  dispatchEvent: (ev: Event | CustomEvent) => {
    const name = ev.type;
    for (const fn of eventListeners.get(name) ?? []) fn(ev);
    return true;
  },
};

let fetchCalls = 0;
let scopeFetchCalls = 0;
let fetchShouldFail = false;

Object.defineProperty(globalThis, "fetch", {
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1;
    const url = String(input);
    if (url.includes("/api/showcase-matrix/scope")) scopeFetchCalls += 1;
    if (fetchShouldFail) {
      throw new Error("network down");
    }
    if (url.includes("/api/showcase-matrix/scope") && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { tradePointIds: string[] };
      const entries: ShowcaseMatrixEntryDto[] = body.tradePointIds.map((tpId, i) => ({
        id: `e-${tpId}`,
        dealerId: "d1",
        tradePointId: tpId,
        targetKind: "model" as const,
        targetId: `m-${i}`,
        status: "installed" as const,
        comment: null,
        updatedAt: "2026-06-01T12:00:00.000Z",
        updatedBy: null,
        updatedByName: null,
        placementType: null,
        placementSegment: null,
        placementCapacity: null,
        placementActual: null,
        placementRef: null,
      }));
      return {
        ok: true,
        async json() {
          return { success: true, entries };
        },
      };
    }
    if (url.includes("/api/showcase-matrix-catalog/list")) {
      return {
        ok: true,
        async json() {
          return { success: true, items: [] };
        },
      };
    }
    return { ok: false, async json() { return { success: false }; } };
  },
  configurable: true,
});

const dealer: DealerRow = {
  id: "d1",
  name: "Дилер",
  city: "Москва",
  status: "активный",
  clientCategory: "top350",
  tradePoints: [
    { id: "tp1", name: "ТТ 1", city: "Москва", address: "", status: "активный" },
    { id: "tp2", name: "ТТ 2", city: "Москва", address: "", status: "активный" },
  ],
} as DealerRow;

const tpScope: DistributionScope = {
  kind: "trade-point",
  dealer,
  point: dealer.tradePoints[0]!,
};

const {
  SHOWCASE_MATRIX_STORE_CACHE_KEY,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} = await import("../showcase-matrix-store.js");

const {
  distributionAnalyticsScopeKey,
  ensureDistributionAnalyticsData,
  getDistributionAnalyticsSnapshot,
  resetDistributionAnalyticsStoreForTests,
  subscribeDistributionAnalytics,
} = await import("../distribution-analytics-store.js");

store.clear();
eventListeners.clear();
fetchCalls = 0;
fetchShouldFail = false;
localStorageMock.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
resetDistributionAnalyticsStoreForTests();

assert.equal(distributionAnalyticsScopeKey(tpScope), "tp:d1:tp1");

const scopeResult = await ensureDistributionAnalyticsData({ scope: tpScope, force: true });
assert.equal(scopeResult.network, true);
assert.equal(scopeFetchCalls, 1);

const raw = localStorageMock.getItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
assert.ok(raw?.includes("tp1|model|m-0"));

const dealerScope: DistributionScope = { kind: "dealer", dealer };
const dealerKey = distributionAnalyticsScopeKey(dealerScope);
assert.ok(dealerKey.startsWith("dealer:d1:"));
assert.ok(dealerKey.includes("tp1"));
assert.ok(dealerKey.includes("tp2"));

fetchShouldFail = true;
fetchCalls = 0;
resetDistributionAnalyticsStoreForTests();
const offline = await ensureDistributionAnalyticsData({ scope: tpScope, force: true });
assert.equal(offline.network, false);
assert.equal(offline.ok, true);

fetchShouldFail = false;
scopeFetchCalls = 0;
fetchCalls = 0;
resetDistributionAnalyticsStoreForTests();
await ensureDistributionAnalyticsData({ scope: tpScope, force: true });
const beforeThrottle = scopeFetchCalls;
await ensureDistributionAnalyticsData({ scope: tpScope });
assert.equal(scopeFetchCalls, beforeThrottle, "throttled second call should not fetch scope");

let subscribeHits = 0;
const unsub = subscribeDistributionAnalytics(() => {
  subscribeHits += 1;
});
const snapBeforeEvent = getDistributionAnalyticsSnapshot();
window.dispatchEvent(new CustomEvent(SHOWCASE_MATRIX_STORE_CHANGED_EVENT));
assert.ok(subscribeHits >= 1);
const snapAfterEvent = getDistributionAnalyticsSnapshot();
assert.notEqual(snapBeforeEvent, snapAfterEvent);
unsub();

resetDistributionAnalyticsStoreForTests();
const stableA = getDistributionAnalyticsSnapshot();
const stableB = getDistributionAnalyticsSnapshot();
assert.equal(stableA, stableB);

console.log("✓ distribution-analytics-store tests passed");
