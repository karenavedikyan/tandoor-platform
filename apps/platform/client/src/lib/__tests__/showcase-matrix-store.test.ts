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
  location: { search: "" },
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
Object.defineProperty(globalThis, "fetch", {
  value: async () => {
    throw new Error("network");
  },
  configurable: true,
});

let opCounter = 0;
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => {
      opCounter += 1;
      return `test-op-uuid-${String(opCounter).padStart(4, "0")}`;
    },
  },
  configurable: true,
});

const {
  showcaseMatrixCacheKey,
  loadCachedMatrix,
  loadCachedPlacements,
  loadCachedPlacementModels,
  setMatrixStatus,
  setMatrixPlacement,
  setMatrixPlacementModel,
  SHOWCASE_MATRIX_STORE_CACHE_KEY,
} = await import("../showcase-matrix-store.js");

const { listPendingSyncItems, OVERRIDES_PENDING_STORAGE_KEY } = await import("../overrides-pending-sync.js");

store.clear();
localStorageMock.removeItem(OVERRIDES_PENDING_STORAGE_KEY);
localStorageMock.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
opCounter = 0;

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
assert.equal(cached[0]?.placementType, null);
assert.equal(cached[0]?.placementSegment, null);
assert.equal(cached[0]?.placementCapacity, null);
assert.equal(cached[0]?.placementActual, null);
assert.equal(cached[0]?.placementRef, null);

const rawCache = localStorageMock.getItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
assert.ok(rawCache?.includes("tp-1|model|m-42"));

let pending = listPendingSyncItems();
assert.equal(pending.length, 0);

setMatrixPlacement({
  dealerId: "d-1",
  tradePointId: "tp-2",
  targetId: "block-portal-1",
  placementType: "portal",
  placementSegment: "vh",
  placementCapacity: 6,
  placementActual: 2,
  comment: "блок портал",
  updatedByName: "Маркетолог",
});

const placementEntry = loadCachedMatrix("tp-2")[0];
assert.equal(placementEntry?.targetKind, "placement");
assert.equal(placementEntry?.status, "installed");
assert.equal(placementEntry?.placementType, "portal");
assert.equal(placementEntry?.placementSegment, "vh");
assert.equal(placementEntry?.placementCapacity, 6);
assert.equal(placementEntry?.placementActual, 2);
assert.equal(placementEntry?.placementRef, null);

assert.ok(
  localStorageMock.getItem(SHOWCASE_MATRIX_STORE_CACHE_KEY)?.includes("tp-2|placement|block-portal-1"),
);

pending = listPendingSyncItems();
const placementPending = pending.find((x) => x.id === "showcase-matrix-upsert:test-op-uuid-0002");
assert.ok(placementPending);
const placementPayload = placementPending!.payload as Record<string, unknown>;
assert.equal(placementPayload.targetKind, "placement");
assert.equal(placementPayload.status, "installed");
assert.equal(placementPayload.placementType, "portal");
assert.equal(placementPayload.placementSegment, "vh");
assert.equal(placementPayload.placementCapacity, 6);
assert.equal(placementPayload.placementActual, 2);
assert.equal(placementPayload.placementRef, null);

setMatrixPlacement({
  dealerId: "d-1",
  tradePointId: "tp-2",
  targetId: "block-portal-1",
  placementType: "portal",
  placementSegment: "vh",
  placementCapacity: 6,
  placementActual: 2,
  placementCompetitors: [{ brand: "RivalCo", count: 1 }],
});

const withCompetitors = loadCachedPlacements("tp-2").find((e) => e.targetId === "block-portal-1");
assert.equal(withCompetitors?.placementCompetitors.length, 1);
assert.equal(withCompetitors?.placementCompetitors[0]?.brand, "RivalCo");

pending = listPendingSyncItems();
const competitorUpserts = pending
  .filter((x) => x.kind === "showcase-matrix-upsert")
  .map((x) => x.payload as Record<string, unknown>)
  .filter((p) => p.targetId === "block-portal-1");
const lastPlacementPayload = competitorUpserts[competitorUpserts.length - 1];
assert.ok(Array.isArray(lastPlacementPayload?.placementCompetitors));
assert.equal(
  (lastPlacementPayload!.placementCompetitors as { brand: string }[])[0]?.brand,
  "RivalCo",
);

setMatrixPlacementModel({
  dealerId: "d-1",
  tradePointId: "tp-2",
  targetKind: "model",
  targetId: "model-in-block",
  placementRef: "block-portal-1",
  status: "installed",
});

const modelInBlock = loadCachedMatrix("tp-2").find((e) => e.targetId === "model-in-block");
assert.equal(modelInBlock?.placementRef, "block-portal-1");
assert.equal(modelInBlock?.placementType, null);

pending = listPendingSyncItems();
const modelPending = pending.find(
  (x) =>
    x.kind === "showcase-matrix-upsert" &&
    (x.payload as Record<string, unknown>).targetId === "model-in-block",
);
assert.equal(modelPending, undefined);

setMatrixStatus({
  dealerId: "d-1",
  tradePointId: "tp-2",
  targetKind: "variant",
  targetId: "sku-loose",
  status: "postponed",
});

const placementsOnly = loadCachedPlacements("tp-2");
assert.equal(placementsOnly.length, 1);
assert.equal(placementsOnly[0]?.targetId, "block-portal-1");

const modelsInBlock = loadCachedPlacementModels("tp-2", "block-portal-1");
assert.equal(modelsInBlock.length, 1);
assert.equal(modelsInBlock[0]?.targetId, "model-in-block");

const looseVariant = loadCachedPlacementModels("tp-2", "missing-block");
assert.equal(looseVariant.length, 0);

console.log("✓ showcase-matrix-store tests passed");
