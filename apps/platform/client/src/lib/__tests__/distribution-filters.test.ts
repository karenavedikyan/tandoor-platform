/**
 * Запуск: npm run test:distribution-filters
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import {
  defaultDistributionEntryTradePointFilterState,
  defaultDistributionFilterState,
  extractCityOptions,
  extractRegionOptions,
  filterEntryRowsByEntryTradePointFilters,
  filterMatrixEntries,
  filterScopeDealers,
  filterScopeDealersByEntryTradePointFilters,
  modelMatchesSegment,
  periodWindowIso,
  buildAnalyticsFilterContext,
} from "../distribution-filters";
import type { DistributionEntryTradePointRow } from "../distribution-entry-tradepoint-view-model.js";
import type { ShowcaseMatrixModelDefinition } from "../trade-point-showcase-matrix-models";

const NOW = Date.parse("2026-06-01T12:00:00.000Z");

const dealerMsk: DealerRow = {
  id: "d-msk",
  name: "Клиент Москва",
  city: "Москва",
  region: "Центр",
  status: "активный",
  clientCategory: "top350",
  tradePoints: [
    { id: "tp1", name: "ТТ 1", city: "Москва", address: "", status: "активный" },
  ],
} as DealerRow;

const dealerKzn: DealerRow = {
  id: "d-kzn",
  name: "Клиент Казань",
  city: "Казань",
  region: "Поволжье",
  status: "активный",
  clientCategory: "top150",
  manager: "Иванов И.И.",
  regionalManager: "Петров П.П.",
  ropName: "Сидоров С.С.",
  tradePoints: [
    { id: "tp2", name: "ТТ 2", city: "Казань", address: "", status: "активный" },
  ],
} as DealerRow;

const dealerSouth: DealerRow = {
  id: "d-south",
  name: "Клиент Юг",
  city: "Краснодар",
  region: "Юг",
  status: "активный",
  clientCategory: "top350",
  manager: "Иванов И.И.",
  regionalManager: "Смирнов С.С.",
  ropName: "Сидоров С.С.",
  managerUserId: "mgr-uuid-1",
  tradePoints: [
    { id: "tp3", name: "ТТ 3", city: "Краснодар", address: "", status: "активный" },
  ],
} as DealerRow;

const defaults = defaultDistributionFilterState();
assert.equal(defaults.period.kind, "all");
assert.equal(defaults.segment, "all");
assert.equal(defaults.clientCategory, "all");
assert.equal(defaults.region, "all");
assert.equal(defaults.city, "all");

const filteredCat = filterScopeDealers([dealerMsk, dealerKzn], {
  ...defaults,
  clientCategory: "top150",
});
assert.equal(filteredCat.length, 1);
assert.equal(filteredCat[0]?.id, "d-kzn");

const filteredCity = filterScopeDealers([dealerMsk, dealerKzn], {
  ...defaults,
  city: "Москва",
});
assert.equal(filteredCity.length, 1);
assert.equal(filteredCity[0]?.id, "d-msk");

const filteredCombo = filterScopeDealers([dealerMsk, dealerKzn], {
  ...defaults,
  region: "Центр",
  clientCategory: "top350",
});
assert.equal(filteredCombo.length, 1);

const allDealers = filterScopeDealers([dealerMsk, dealerKzn], defaults);
assert.equal(allDealers.length, 2);

const winAll = periodWindowIso({ kind: "all" }, NOW);
assert.equal(winAll.fromIso, null);
assert.equal(winAll.toIso, null);

const win7 = periodWindowIso({ kind: "last7" }, NOW);
assert.ok(win7.fromIso);
assert.ok(win7.toIso);
const fromMs = Date.parse(win7.fromIso!);
assert.equal(fromMs, NOW - 7 * 86_400_000);

const winCustom = periodWindowIso(
  { kind: "custom", fromIso: "2026-01-01T00:00:00.000Z", toIso: "2026-02-01T00:00:00.000Z" },
  NOW,
);
assert.equal(winCustom.fromIso, "2026-01-01T00:00:00.000Z");
assert.equal(winCustom.toIso, "2026-02-01T00:00:00.000Z");

const entranceModel = {
  id: "m-vh",
  type: "entrance",
} as ShowcaseMatrixModelDefinition;
const interiorModel = {
  id: "m-mk",
  type: "interior",
} as ShowcaseMatrixModelDefinition;

assert.equal(modelMatchesSegment(entranceModel, "vh"), true);
assert.equal(modelMatchesSegment(entranceModel, "mk"), false);
assert.equal(modelMatchesSegment(interiorModel, "mk"), true);
assert.equal(modelMatchesSegment(interiorModel, "furniture"), false);

const entry: ShowcaseMatrixEntryDto = {
  id: "e1",
  dealerId: "d1",
  tradePointId: "tp1",
  targetKind: "model",
  targetId: "m-vh",
  status: "installed",
  comment: null,
  updatedAt: "2026-05-15T10:00:00.000Z",
  updatedBy: null,
  updatedByName: null,
  placementType: null,
  placementSegment: null,
  placementCapacity: null,
  placementActual: null,
  placementRef: null,
};

const ctx = buildAnalyticsFilterContext({ ...defaults, period: { kind: "last30" } }, NOW);
const filteredEntries = filterMatrixEntries([entry], ctx, new Set(["m-vh"]));
assert.equal(filteredEntries.length, 1);

const ctxOld = buildAnalyticsFilterContext({ ...defaults, period: { kind: "last7" } }, NOW);
const filteredOld = filterMatrixEntries([entry], ctxOld, new Set(["m-vh"]));
assert.equal(filteredOld.length, 0);

assert.deepEqual(extractRegionOptions([dealerMsk, dealerKzn]), ["Поволжье", "Центр"]);
assert.ok(extractCityOptions([dealerMsk, dealerKzn]).includes("Казань"));
assert.ok(extractCityOptions([dealerMsk, dealerKzn]).includes("Москва"));

const ttDefaults = defaultDistributionEntryTradePointFilterState();
assert.deepEqual(ttDefaults.managerIds, []);
assert.deepEqual(ttDefaults.cityValues, []);
assert.equal(ttDefaults.status, "all");

const allTtDealers = filterScopeDealersByEntryTradePointFilters(
  [dealerMsk, dealerKzn, dealerSouth],
  ttDefaults,
);
assert.equal(allTtDealers.length, 3);

const filteredManagers = filterScopeDealersByEntryTradePointFilters(
  [dealerMsk, dealerKzn, dealerSouth],
  { ...ttDefaults, managerIds: ["mgr:Иванов И.И."] },
);
assert.equal(filteredManagers.length, 2);
assert.ok(filteredManagers.some((d) => d.id === "d-kzn"));
assert.ok(filteredManagers.some((d) => d.id === "d-south"));

const filteredRegionAndManager = filterScopeDealersByEntryTradePointFilters(
  [dealerMsk, dealerKzn, dealerSouth],
  {
    ...ttDefaults,
    regionValues: ["Юг"],
    managerIds: ["mgr-uuid-1"],
  },
);
assert.equal(filteredRegionAndManager.length, 1);
assert.equal(filteredRegionAndManager[0]?.id, "d-south");

const filteredCities = filterScopeDealersByEntryTradePointFilters(
  [dealerMsk, dealerKzn, dealerSouth],
  { ...ttDefaults, cityValues: ["Москва", "Казань"] },
);
assert.equal(filteredCities.length, 2);

const filteredCategories = filterScopeDealersByEntryTradePointFilters(
  [dealerMsk, dealerKzn, dealerSouth],
  { ...ttDefaults, clientCategoryIds: ["top150", "top350"] },
);
assert.equal(filteredCategories.length, 3);

const resetAfterFilter = defaultDistributionEntryTradePointFilterState();
assert.equal(
  filterScopeDealersByEntryTradePointFilters([dealerMsk, dealerKzn], {
    ...resetAfterFilter,
    managerIds: ["mgr:Иванов И.И."],
    regionValues: ["Юг"],
  }).length,
  0,
);
assert.equal(
  filterScopeDealersByEntryTradePointFilters([dealerMsk, dealerKzn, dealerSouth], resetAfterFilter).length,
  3,
);

function entryRow(
  partial: Partial<DistributionEntryTradePointRow> & Pick<DistributionEntryTradePointRow, "tradePointId" | "tradePointName">,
): DistributionEntryTradePointRow {
  return {
    dealerId: "d1",
    clientName: "Клиент",
    city: "Москва",
    clientCategory: "top350",
    managerName: "Иванов И.И.",
    regionalManagerName: "Петров П.П.",
    responsibleManagerName: null,
    furnitureManagerName: null,
    ropName: null,
    legalInn: "7700000000",
    address: "ул. Ленина, 1",
    templateModelsCount: 4,
    filledCount: 2,
    coveragePct: 50,
    lastUpdatedAt: null,
    installedOursTotal: 2,
    installedOursBySegment: { vh: 1, mk: 1, hardware: 0 },
    installedOursRotation: 0,
    ...partial,
  };
}

const entryRows = [
  entryRow({ tradePointId: "tp1", tradePointName: "ТТ 1", city: "Москва", managerName: "Иванов И.И." }),
  entryRow({
    tradePointId: "tp2",
    tradePointName: "ТТ 2",
    city: "Казань",
    managerName: "Сидоров С.С.",
    regionalManagerName: "Смирнов С.С.",
    clientCategory: "top150",
  }),
];

assert.equal(filterEntryRowsByEntryTradePointFilters(entryRows, defaultDistributionEntryTradePointFilterState()).length, 2);

assert.equal(
  filterEntryRowsByEntryTradePointFilters(entryRows, {
    ...defaultDistributionEntryTradePointFilterState(),
    managerIds: ["Иванов И.И."],
  }).length,
  1,
);

assert.equal(
  filterEntryRowsByEntryTradePointFilters(entryRows, {
    ...defaultDistributionEntryTradePointFilterState(),
    regionalManagerIds: ["Смирнов С.С."],
  })[0]?.tradePointId,
  "tp2",
);

assert.equal(
  filterEntryRowsByEntryTradePointFilters(entryRows, {
    ...defaultDistributionEntryTradePointFilterState(),
    cityValues: ["Казань"],
  })[0]?.tradePointId,
  "tp2",
);

assert.equal(
  filterEntryRowsByEntryTradePointFilters(entryRows, {
    ...defaultDistributionEntryTradePointFilterState(),
    clientCategoryIds: ["top150"],
  })[0]?.tradePointId,
  "tp2",
);

console.log("✓ distribution-filters tests passed");
