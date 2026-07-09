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
  location: { search: "" },
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});

const {
  dequeuePendingSync,
  enqueuePendingSync,
  listPendingSyncItems,
  markPendingSyncDead,
  markPendingSyncFailed,
  OVERRIDES_PENDING_STORAGE_KEY,
  pendingSyncCount,
  removePendingSyncWithUuidErrors,
  remapPendingSyncDefId,
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

for (const item of listPendingSyncItems({ includeDead: true })) {
  dequeuePendingSync(item.id);
}

enqueuePendingSync({
  id: "showcase-matrix-catalog-upsert:op-cat-1",
  kind: "showcase-matrix-catalog-upsert",
  payload: {
    clientCategory: "top150",
    scopeKind: "global",
    clientOpId: "op-cat-1",
  },
});
enqueuePendingSync({
  id: "showcase-matrix-catalog-set-status:op-cat-2",
  kind: "showcase-matrix-catalog-set-status",
  payload: { id: "def-uuid", status: "published", clientOpId: "op-cat-2" },
});
enqueuePendingSync({
  id: "showcase-matrix-catalog-delete:op-cat-3",
  kind: "showcase-matrix-catalog-delete",
  payload: { id: "def-uuid", clientOpId: "op-cat-3" },
});
enqueuePendingSync({
  id: "showcase-matrix-catalog-replace-models:op-cat-4",
  kind: "showcase-matrix-catalog-replace-models",
  payload: {
    defId: "def-uuid",
    models: [{ targetKind: "model", targetId: "m1", segment: "vh" }],
    clientOpId: "op-cat-4",
  },
});

const catalogKinds = listPendingSyncItems().map((x) => x.kind);
assert.ok(catalogKinds.includes("showcase-matrix-catalog-upsert"));
assert.ok(catalogKinds.includes("showcase-matrix-catalog-set-status"));
assert.ok(catalogKinds.includes("showcase-matrix-catalog-delete"));
assert.ok(catalogKinds.includes("showcase-matrix-catalog-replace-models"));

const workerFetchLog: { url: string; body: unknown }[] = [];
Object.defineProperty(globalThis, "fetch", {
  value: async (url: string, init?: RequestInit) => {
    workerFetchLog.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, def: { id: "def-uuid" }, idempotent: false, models: [] };
      },
    };
  },
  configurable: true,
});

const { runOverridesPendingSyncOnce } = await import("../overrides-pending-sync-worker.js");
const { SHOWCASE_MATRIX_CATALOG_CACHE_KEY } = await import("../showcase-matrix-catalog-store.js");
const runResult = await runOverridesPendingSyncOnce();
assert.ok(runResult, "worker should run when queue has catalog ops");
assert.equal(runResult!.succeeded, 4);
assert.equal(listPendingSyncItems().length, 0);
const upsertCall = workerFetchLog.find((c) => c.url.includes("/upsert"));
assert.ok(upsertCall?.url.includes("showcase-matrix-catalog"));
assert.equal((upsertCall?.body as Record<string, unknown>).clientCategory, "top150");
assert.ok(workerFetchLog.some((c) => c.url.includes("/set-status")));
assert.ok(workerFetchLog.some((c) => c.url.includes("/delete")));
assert.ok(workerFetchLog.some((c) => c.url.includes("/replace-models")));

store.clear();
workerFetchLog.length = 0;

enqueuePendingSync({
  id: "showcase-matrix-upsert:op-legacy-1",
  kind: "showcase-matrix-upsert",
  payload: {
    dealerId: "d1",
    tradePointId: "tp1",
    targetKind: "placement",
    targetId: "block-mk-book",
    status: "installed",
    clientOpId: "op-legacy-1",
    placementType: "book",
    placementSegment: "mk",
    placementCapacity: 66,
    placementActual: 0,
    placementLegacyOurs: 3,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
  },
});

const matrixRun = await runOverridesPendingSyncOnce();
assert.ok(matrixRun, "worker should sync showcase-matrix-upsert");
assert.equal(matrixRun!.succeeded, 1);
const matrixUpsertCall = workerFetchLog.find((c) => c.url.includes("/api/showcase-matrix/upsert"));
assert.ok(matrixUpsertCall, "showcase-matrix upsert API should be called");
const matrixBody = matrixUpsertCall!.body as Record<string, unknown>;
assert.equal(matrixBody.placementLegacyOurs, 3);
assert.equal(matrixBody.placementCapacity, 66);

store.clear();

const localDefId = "local-op-remap-1";
const serverDefId = "8cc870fe-6fd0-4399-9ac0-f34f1053fb2c";
enqueuePendingSync({
  id: "showcase-matrix-catalog-replace-models:op-remap-1",
  kind: "showcase-matrix-catalog-replace-models",
  payload: { defId: localDefId, models: [], clientOpId: "op-remap-1" },
});
enqueuePendingSync({
  id: "showcase-matrix-catalog-set-status:op-remap-2",
  kind: "showcase-matrix-catalog-set-status",
  payload: { id: localDefId, status: "published", clientOpId: "op-remap-2" },
});
enqueuePendingSync({
  id: "showcase-matrix-catalog-delete:op-remap-3",
  kind: "showcase-matrix-catalog-delete",
  payload: { id: localDefId, clientOpId: "op-remap-3" },
});
enqueuePendingSync({
  id: "showcase-matrix-catalog-replace-models:op-other",
  kind: "showcase-matrix-catalog-replace-models",
  payload: { defId: "local-other", models: [], clientOpId: "op-other" },
});
remapPendingSyncDefId(localDefId, serverDefId);
const remapped = listPendingSyncItems({ includeDead: true });
const replaceRemapped = remapped.find((x) => x.id === "showcase-matrix-catalog-replace-models:op-remap-1");
assert.equal((replaceRemapped?.payload as Record<string, unknown>).defId, serverDefId);
const statusRemapped = remapped.find((x) => x.id === "showcase-matrix-catalog-set-status:op-remap-2");
assert.equal((statusRemapped?.payload as Record<string, unknown>).id, serverDefId);
const deleteRemapped = remapped.find((x) => x.id === "showcase-matrix-catalog-delete:op-remap-3");
assert.equal((deleteRemapped?.payload as Record<string, unknown>).id, serverDefId);
const otherReplace = remapped.find((x) => x.id === "showcase-matrix-catalog-replace-models:op-other");
assert.equal((otherReplace?.payload as Record<string, unknown>).defId, "local-other");

store.clear();
workerFetchLog.length = 0;
Object.defineProperty(globalThis, "fetch", {
  value: async (url: string, init?: RequestInit) => {
    workerFetchLog.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return {
      ok: true,
      status: 200,
      async json() {
        if (url.includes("/upsert")) {
          return {
            success: true,
            def: { id: serverDefId, clientCategory: "new_client", scopeKind: "global", status: "draft" },
            idempotent: false,
          };
        }
        return { success: true, def: { id: serverDefId }, idempotent: false, models: [] };
      },
    };
  },
  configurable: true,
});

const remapClientOpId = "op-remap-flow";
const remapLocalDefId = `local-${remapClientOpId}`;
localStorageMock.setItem(
  SHOWCASE_MATRIX_CATALOG_CACHE_KEY,
  JSON.stringify({
    headers: [
      {
        id: remapLocalDefId,
        clientCategory: "new_client",
        scopeKind: "global",
        status: "draft",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    defsById: {
      [remapLocalDefId]: {
        id: remapLocalDefId,
        clientCategory: "new_client",
        scopeKind: "global",
        status: "draft",
        updatedAt: "2026-01-01T00:00:00.000Z",
        models: [],
      },
    },
  }),
);
enqueuePendingSync({
  id: `showcase-matrix-catalog-upsert:${remapClientOpId}`,
  kind: "showcase-matrix-catalog-upsert",
  payload: { clientCategory: "new_client", scopeKind: "global", clientOpId: remapClientOpId },
});
enqueuePendingSync({
  id: "showcase-matrix-catalog-replace-models:op-remap-flow-2",
  kind: "showcase-matrix-catalog-replace-models",
  payload: {
    defId: remapLocalDefId,
    models: [{ targetKind: "model", targetId: "m-1", segment: "vh" }],
    clientOpId: "op-remap-flow-2",
  },
});
const workerRun = await runOverridesPendingSyncOnce();
assert.ok(workerRun);
assert.equal(workerRun!.succeeded, 2);
const replaceCall = workerFetchLog.find((c) => c.url.includes("/replace-models"));
assert.equal((replaceCall?.body as Record<string, unknown>).defId, serverDefId);
const remappedCache = JSON.parse(localStorageMock.getItem(SHOWCASE_MATRIX_CATALOG_CACHE_KEY)!);
assert.equal(remappedCache.headers[0]?.id, serverDefId);

console.log("✓ overrides-pending-sync tests passed");
