/**
 * Запуск: npm run test:showcase-matrix-catalog-store
 */
import assert from "node:assert/strict";

const store = new Map<string, string>();
const remoteEvents: unknown[] = [];
const changedEvents: unknown[] = [];

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
  dispatchEvent: (ev: Event) => {
    if (ev.type === "tandoor:showcase-matrix-catalog:remote-update") {
      remoteEvents.push((ev as CustomEvent).detail);
    }
    if (ev.type === "tandoor:showcase-matrix-catalog:changed") {
      changedEvents.push(true);
    }
    return true;
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});

let fetchCalls = 0;
let listResponse: unknown = null;
let getResponse: unknown = null;

Object.defineProperty(globalThis, "fetch", {
  value: async (url: string) => {
    fetchCalls += 1;
    if (url.includes("/list")) {
      return {
        ok: true,
        async json() {
          return listResponse;
        },
      };
    }
    if (url.includes("/get")) {
      return {
        ok: true,
        async json() {
          return getResponse;
        },
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  },
  configurable: true,
});

let opCounter = 0;
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => {
      opCounter += 1;
      return `catalog-op-${String(opCounter).padStart(4, "0")}`;
    },
  },
  configurable: true,
});

const {
  loadCachedMatrixDefs,
  loadCachedMatrixDef,
  refreshMatrixCatalogFromServer,
  refreshMatrixDefFromServer,
  upsertMatrixDefLocal,
  replaceMatrixDefModelsLocal,
  deleteMatrixDefLocal,
  setMatrixDefStatusLocal,
  SHOWCASE_MATRIX_CATALOG_CACHE_KEY,
  SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT,
} = await import("../showcase-matrix-catalog-store.js");

const { listPendingSyncItems, OVERRIDES_PENDING_STORAGE_KEY } = await import("../overrides-pending-sync.js");

store.clear();
localStorageMock.removeItem(OVERRIDES_PENDING_STORAGE_KEY);
localStorageMock.removeItem(SHOWCASE_MATRIX_CATALOG_CACHE_KEY);
remoteEvents.length = 0;
changedEvents.length = 0;
opCounter = 0;
fetchCalls = 0;

assert.equal(SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT, "tandoor:showcase-matrix-catalog:changed");

const { def: created } = upsertMatrixDefLocal({
  clientCategory: "top150",
  scopeKind: "global",
  title: "Test matrix",
});
assert.equal(created.status, "draft");
assert.equal(loadCachedMatrixDefs().length, 1);
assert.ok(changedEvents.length >= 1);

let pending = listPendingSyncItems();
assert.equal(pending.length, 1);
assert.equal(pending[0]?.kind, "showcase-matrix-catalog-upsert");
assert.equal(pending[0]?.id, "showcase-matrix-catalog-upsert:catalog-op-0001");

const upsertPayload = pending[0]?.payload as Record<string, unknown>;
assert.equal(upsertPayload.clientCategory, "top150");
assert.equal(upsertPayload.clientOpId, "catalog-op-0001");

replaceMatrixDefModelsLocal(created.id, [
  { targetKind: "model", targetId: "m-1", segment: "vh", priority: "high", sortOrder: 0 },
  { targetKind: "variant", targetId: "v-2", segment: "mk", sortOrder: 1 },
]);

const full = loadCachedMatrixDef(created.id);
assert.equal(full?.models.length, 2);
assert.equal(full?.models[0]?.targetId, "m-1");

pending = listPendingSyncItems();
const replacePending = pending.find((x) => x.kind === "showcase-matrix-catalog-replace-models");
assert.ok(replacePending);
const replacePayload = replacePending!.payload as Record<string, unknown>;
assert.equal(replacePayload.defId, created.id);
assert.ok(Array.isArray(replacePayload.models));

replaceMatrixDefModelsLocal(created.id, [
  { targetKind: "model", targetId: "only-one", segment: "hardware" },
]);
const replaced = loadCachedMatrixDef(created.id);
assert.equal(replaced?.models.length, 1);
assert.equal(replaced?.models[0]?.targetId, "only-one");

setMatrixDefStatusLocal(created.id, "published");
assert.equal(loadCachedMatrixDefs()[0]?.status, "published");

remoteEvents.length = 0;
fetchCalls = 0;
const cachedHeader = loadCachedMatrixDefs()[0]!;
listResponse = {
  success: true,
  defs: [{ ...cachedHeader }],
};
const refreshedSame = await refreshMatrixCatalogFromServer();
assert.equal(refreshedSame.length, 1);
assert.equal(remoteEvents.length, 0, "unchanged snapshot should not emit remote-update");

fetchCalls = 0;
remoteEvents.length = 0;
listResponse = {
  success: true,
  defs: [
    {
      ...created,
      status: "published",
      updatedAt: "2026-06-01T12:00:00.000Z",
      title: "Updated title",
    },
  ],
};
const refreshedChanged = await refreshMatrixCatalogFromServer();
assert.equal(refreshedChanged[0]?.title, "Updated title");
assert.equal(remoteEvents.length, 1, "changed snapshot should emit remote-update");

getResponse = {
  success: true,
  def: {
    ...created,
    status: "published",
    updatedAt: "2026-06-02T12:00:00.000Z",
    models: [{ id: "srv-m1", defId: created.id, targetKind: "model", targetId: "srv", segment: "vh", priority: "medium", valueWeight: null, sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
  },
};
remoteEvents.length = 0;
await refreshMatrixDefFromServer(created.id);
assert.equal(loadCachedMatrixDef(created.id)?.models[0]?.targetId, "srv");
assert.equal(remoteEvents.length, 1);

deleteMatrixDefLocal(created.id);
assert.equal(loadCachedMatrixDefs().length, 0);
pending = listPendingSyncItems();
assert.ok(pending.some((x) => x.kind === "showcase-matrix-catalog-delete"));

const {
  apiUpsertMatrixDefStrict,
  apiSetMatrixDefStatusStrict,
  apiDeleteMatrixDefStrict,
  apiReplaceMatrixDefModelsStrict,
} = await import("../showcase-matrix-catalog-api.js");

let strictUrl = "";
let strictBody: unknown = null;
Object.defineProperty(globalThis, "fetch", {
  value: async (url: string, init?: RequestInit) => {
    strictUrl = url;
    strictBody = init?.body ? JSON.parse(String(init.body)) : null;
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, def: { id: "x" }, idempotent: false, models: [] };
      },
    };
  },
  configurable: true,
});

const upsertStrict = await apiUpsertMatrixDefStrict({
  clientCategory: "top350",
  scopeKind: "region",
  scopeRegion: "москва",
});
assert.equal(upsertStrict.ok, true);
assert.ok(strictUrl.includes("/upsert"));
assert.equal((strictBody as Record<string, unknown>).clientCategory, "top350");

await apiSetMatrixDefStatusStrict("def-1", "archived");
assert.ok(strictUrl.includes("/set-status"));

await apiDeleteMatrixDefStrict("def-1");
assert.ok(strictUrl.includes("/delete"));

await apiReplaceMatrixDefModelsStrict("def-1", [
  { targetKind: "model", targetId: "a", segment: "vh" },
]);
assert.ok(strictUrl.includes("/replace-models"));

console.log("✓ showcase-matrix-catalog-store tests passed");
