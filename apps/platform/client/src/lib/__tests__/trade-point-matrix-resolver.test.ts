/**
 * Запуск: npm run test:trade-point-matrix-resolver (из apps/platform).
 */
import assert from "node:assert/strict";
import {
  compareMatrixDefTieBreak,
  isMatrixDefEffectiveOnDate,
  pickResolvedMatrixDef,
  type ShowcaseMatrixDefDto,
  type ShowcaseMatrixDefWithModelsDto,
} from "@shared/showcase-matrix-catalog-handlers.js";
import {
  resolveActiveMatrixDefFromCache,
  todayIsoDateLocal,
} from "../showcase-matrix-catalog-resolve.js";
import {
  resolveActiveManagedMatrix,
  resolveTradePointMatrixModels,
} from "../trade-point-matrix-resolver.js";

const CACHE_KEY = "tandoor:showcase-matrix-catalog:cache-v1";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();

globalThis.window = {
  localStorage: localStorageMock,
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
} as unknown as Window;

function def(partial: Partial<ShowcaseMatrixDefDto> & Pick<ShowcaseMatrixDefDto, "id">): ShowcaseMatrixDefDto {
  return {
    clientCategory: "top150",
    scopeKind: "global",
    scopeRegion: null,
    scopeCity: null,
    effectiveFrom: null,
    effectiveTo: null,
    seasonLabel: null,
    status: "published",
    title: null,
    comment: null,
    clientOpId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    ...partial,
  };
}

function fullDef(
  header: ShowcaseMatrixDefDto,
  models: ShowcaseMatrixDefWithModelsDto["models"],
): ShowcaseMatrixDefWithModelsDto {
  return { ...header, models };
}

function seedCache(payload: { headers: ShowcaseMatrixDefDto[]; defsById: Record<string, ShowcaseMatrixDefWithModelsDto> }) {
  localStorageMock.setItem(CACHE_KEY, JSON.stringify(payload));
}

seedCache({ headers: [], defsById: {} });

const hardcoded = resolveTradePointMatrixModels({
  dealerId: "d-fallback",
  tradePointId: "tp-fallback",
  clientCategory: "top150",
  region: "краснодарский край",
  city: "краснодар",
  onDate: "2026-06-15",
});
assert.ok(hardcoded.length > 0, "fallback returns hardcoded models");

const globalHeader = def({ id: "def-global", scopeKind: "global", clientCategory: "top150" });
const regionHeader = def({
  id: "def-region",
  scopeKind: "region",
  scopeRegion: "краснодарский край",
  clientCategory: "top150",
  effectiveFrom: "2026-01-01",
});
const cityHeader = def({
  id: "def-city",
  scopeKind: "city",
  scopeRegion: "краснодарский край",
  scopeCity: "краснодар",
  clientCategory: "top150",
});

const ONE_C_PRODUCT_ID = "e626a249-a8ef-11ec-8115-00155d0a0a4e";

const modelRow = {
  id: "m1",
  defId: "def-city",
  targetKind: "model" as const,
  targetId: ONE_C_PRODUCT_ID,
  priority: "high" as const,
  segment: "vh" as const,
  valueWeight: 5,
  sortOrder: 0,
  catalog1cId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

seedCache({
  headers: [globalHeader, regionHeader, cityHeader],
  defsById: {
    "def-city": fullDef(cityHeader, [modelRow]),
  },
});

const resolved = resolveActiveMatrixDefFromCache({
  clientCategory: "top150",
  region: "Краснодарский край",
  city: "Краснодар",
  onDate: "2026-06-15",
});
assert.ok(resolved);
assert.equal(resolved!.id, "def-city");

const managed = resolveActiveManagedMatrix({
  dealerId: "d1",
  tradePointId: "tp1",
  clientCategory: "top150",
  region: "краснодарский край",
  city: "краснодар",
  onDate: "2026-06-15",
});
assert.ok(managed);
assert.equal(managed!.source, "managed");
assert.equal(managed!.models.length, 1);
assert.equal(managed!.models[0]!.id, ONE_C_PRODUCT_ID);
assert.equal(managed!.models[0]!.catalog1cId, ONE_C_PRODUCT_ID);

const fromResolver = resolveTradePointMatrixModels({
  dealerId: "d1",
  tradePointId: "tp1",
  clientCategory: "top150",
  region: "краснодарский край",
  city: "краснодар",
  onDate: "2026-06-15",
});
assert.equal(fromResolver.length, 1);
assert.equal(fromResolver[0]!.id, ONE_C_PRODUCT_ID);

seedCache({ headers: [globalHeader], defsById: {} });
const onlyGlobal = resolveActiveMatrixDefFromCache({
  clientCategory: "top150",
  region: "москва",
  city: "химки",
  onDate: "2026-06-15",
});
assert.equal(onlyGlobal?.id, "def-global");

assert.equal(isMatrixDefEffectiveOnDate(def({ id: "x", effectiveFrom: "2026-06-01", effectiveTo: "2026-06-30" }), "2026-06-15"), true);
assert.equal(isMatrixDefEffectiveOnDate(def({ id: "x", effectiveFrom: "2026-07-01" }), "2026-06-15"), false);

const picked = pickResolvedMatrixDef(
  [def({ id: "a", scopeKind: "region", scopeRegion: "ростовская область" }), def({ id: "b", scopeKind: "global" })],
  { region: "ростовская область", city: "ростов-на-дону" },
);
assert.equal(picked?.id, "a");
assert.ok(compareMatrixDefTieBreak);

console.log("trade-point-matrix-resolver.test.ts: ok");
