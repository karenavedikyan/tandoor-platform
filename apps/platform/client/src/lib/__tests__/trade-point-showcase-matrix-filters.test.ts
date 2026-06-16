/**
 * Запуск: `npm run test:trade-point-showcase-matrix-filters` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  filterShowcaseModelsForDisplay,
  modelsMatchingCategory,
  pruneCatalogFiltersForAllowedKeys,
  readShowcaseMatrixCategoryFilterFromStorage,
  writeShowcaseMatrixCategoryFilterToStorage,
  SHOWCASE_MATRIX_CATEGORY_FILTER_STORAGE_KEY_PREFIX,
  type ShowcaseMatrixCategoryFilter,
} from "../trade-point-showcase-matrix-filters";
import type { ShowcaseMatrixModelDefinition } from "../trade-point-showcase-matrix-models";
import type { ShowcaseMatrixStatusId } from "../trade-point-showcase-matrix-storage";

function model(
  id: string,
  type: ShowcaseMatrixModelDefinition["type"],
  status: ShowcaseMatrixStatusId = "need_install",
): ShowcaseMatrixModelDefinition {
  return {
    id,
    name: id,
    type,
    typeLabelRu: type === "entrance" ? "ВХ" : type === "hardware" ? "Фурнитура" : "МК",
    imageUrl: "",
    basePriority: "medium",
    importanceReason: "",
    characteristics: "",
    advantages: "",
    benefitsDealer: "",
    benefitsBuyer: "",
    objections: "",
    objectionAnswers: "",
    copyMessage: "",
    __status: status,
  } as ShowcaseMatrixModelDefinition & { __status: ShowcaseMatrixStatusId };
}

const allModels = [
  model("vh-1", "entrance", "need_install"),
  model("mk-1", "interior", "installed"),
  model("hw-1", "hardware", "postponed"),
  model("vh-2", "entrance", "installed"),
];

const statusById: Record<string, ShowcaseMatrixStatusId> = {
  "vh-1": "need_install",
  "mk-1": "installed",
  "hw-1": "postponed",
  "vh-2": "installed",
};

function effectiveStatus(id: string): ShowcaseMatrixStatusId {
  return statusById[id] ?? "need_install";
}

const passAllCatalog = () => true;

// hardware filter
{
  const scoped = modelsMatchingCategory(allModels, "hardware");
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.id, "hw-1");
}

// смена статуса не меняет categoryFilter (логика фильтрации)
{
  const categoryFilter: ShowcaseMatrixCategoryFilter = "entrance";
  const catalogFilters = { series: ["Эра"] };

  const needed = filterShowcaseModelsForDisplay(
    allModels,
    "needed",
    categoryFilter,
    catalogFilters,
    effectiveStatus,
    passAllCatalog,
  );
  const installed = filterShowcaseModelsForDisplay(
    allModels,
    "installed",
    categoryFilter,
    catalogFilters,
    effectiveStatus,
    passAllCatalog,
  );

  assert.ok(needed.every((m) => m.type === "entrance"));
  assert.ok(installed.every((m) => m.type === "entrance"));
  assert.equal(needed.length, 1);
  assert.equal(installed.length, 1);
  assert.notEqual(needed[0]?.id, installed[0]?.id);
}

// смена категории должна обнулять catalogFilters (симуляция эффекта компонента)
{
  let catalogFilters: Record<string, string[]> = { series: ["Эра"], color: ["Белый"] };
  const prevCategory: ShowcaseMatrixCategoryFilter = "entrance";
  let categoryFilter: ShowcaseMatrixCategoryFilter = "interior";

  if (categoryFilter !== prevCategory) {
    catalogFilters = {};
  }
  assert.deepEqual(catalogFilters, {});

  categoryFilter = "hardware";
  const scoped = modelsMatchingCategory(allModels, categoryFilter);
  assert.equal(scoped.length, 1);
  assert.equal(scoped[0]?.type, "hardware");
}

// pruneCatalogFiltersForAllowedKeys — не трогает при тех же ключах
{
  const prev = { series: ["A"], color: ["B"] };
  const allowed = new Set(["series", "color", "size"]);
  assert.equal(pruneCatalogFiltersForAllowedKeys(prev, allowed), prev);
}

{
  const prev = { series: ["A"], obsolete: ["X"] };
  const next = pruneCatalogFiltersForAllowedKeys(prev, new Set(["series"]));
  assert.deepEqual(next, { series: ["A"] });
}

// sessionStorage category filter
{
  const storage = new Map<string, string>();
  const g = globalThis as typeof globalThis & {
    window?: { sessionStorage: Storage };
  };
  const prior = g.window;
  g.window = {
    sessionStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    },
  };

  const tpId = "tp-test-352";
  assert.equal(readShowcaseMatrixCategoryFilterFromStorage(tpId), "all");
  writeShowcaseMatrixCategoryFilterToStorage(tpId, "hardware");
  assert.equal(
    storage.get(`${SHOWCASE_MATRIX_CATEGORY_FILTER_STORAGE_KEY_PREFIX}${tpId}`),
    "hardware",
  );
  assert.equal(readShowcaseMatrixCategoryFilterFromStorage(tpId), "hardware");

  if (prior) g.window = prior;
  else delete g.window;
}

console.log("trade-point-showcase-matrix-filters: ok");
