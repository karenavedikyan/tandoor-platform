/**
 * Запуск: `npm run test:distribution-analytics-view-models` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { ActualizationState } from "../client-base-actualization-state";
import type { DealerRow, DealerTradePoint } from "../dealer-base-mock-data";
import type { MergedTradePointEntry } from "../dealer-trade-points-overrides";
import type { TradePointListRow } from "../trade-point-list-for-actualization";
import {
  applyDistributionAnalyticsFilters,
  deserializeFilters,
  emptyDistributionAnalyticsFilters,
  serializeFilters,
} from "../distribution-analytics/distribution-analytics-filters";

function makeRow(partial: Partial<TradePointListRow> & { tradePointId: string; dealerId: string }): TradePointListRow {
  const dealer = {
    id: partial.dealerId,
    name: partial.dealerName ?? "Dealer",
    region: partial.dealer?.region ?? "Юг",
    clientCategory: partial.clientCategory ?? "top150",
  } as DealerRow;
  const point = { id: partial.tradePointId, name: partial.tradePointName ?? "TP", city: partial.city ?? "Краснодар" } as DealerTradePoint;
  return {
    tradePointId: partial.tradePointId,
    dealerId: partial.dealerId,
    dealer,
    point,
    entry: { point } as MergedTradePointEntry,
    tradePointDisplayCode: partial.tradePointDisplayCode ?? partial.tradePointId,
    dealerClientCode: "C1",
    dealerName: partial.dealerName ?? "Dealer",
    tradePointName: partial.tradePointName ?? "TP",
    city: partial.city ?? "Краснодар",
    address: "",
    tradePointFormatLabel: null,
    manager: partial.manager ?? "Иванов",
    regionalManager: partial.regionalManager ?? "Петров",
    rop: partial.rop ?? "Сидоров",
    clientCategory: partial.clientCategory ?? "top150",
    clientCategoryLabel: "ТОП 150",
    showcaseBucket: "partial",
    showcaseBucketLabel: "Частично",
    portalsTotal: null,
    modelsOnShowcaseCount: 0,
    matrixDeficitCount: 0,
    showcaseNewTasksCount: 0,
    portalOverfill: false,
    portalsUnfilled: true,
    hasFreePortals: false,
    hasShowcase: partial.hasShowcase ?? true,
    showcaseUpdatedAt: null,
    unloadingOrder: null,
    isArchived: false,
    isVirtual: false,
    searchHaystack: "",
    ...partial,
  };
}

const act = {
  tradePointShowcaseActualizationById: {
    "tp-1": {
      tradePointId: "tp-1",
      dealerId: "d-1",
      hasShowcase: true,
      entrancePortals: 5,
      interiorPortals: null,
      hardwareSections: null,
      selectedShowcaseModels: [{ productId: "m-a", productName: "A", productType: "Модель", selectedAt: "", selectedBy: "", selectedByName: "" }],
    },
    "tp-2": {
      tradePointId: "tp-2",
      dealerId: "d-2",
      hasShowcase: true,
      entrancePortals: null,
      interiorPortals: 3,
      hardwareSections: null,
      selectedShowcaseModels: [],
    },
  },
  dealerOverridesById: {},
} as unknown as ActualizationState;

const rows = [
  makeRow({ tradePointId: "tp-1", dealerId: "d-1", city: "Краснодар", clientCategory: "top150", manager: "Иванов" }),
  makeRow({ tradePointId: "tp-2", dealerId: "d-2", city: "Москва", clientCategory: "top350", manager: "Петров" }),
];

const shMap = act.tradePointShowcaseActualizationById;
const catalogLookup = () => undefined;

assert.equal(applyDistributionAnalyticsFilters(rows, emptyDistributionAnalyticsFilters(), shMap, act, catalogLookup).length, 2);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), dealerIds: ["d-2"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), tradePointIds: ["tp-1"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), clientCategories: ["top350"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), managerIds: ["Иванов"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), equipmentTypes: ["entrance"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), equipmentTypes: ["interior"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), modelIds: ["m-a"] }, shMap, act, catalogLookup).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(
    rows,
    { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар"], clientCategories: ["top150"], equipmentTypes: ["entrance"] },
    shMap,
    act,
    catalogLookup,
  ).length,
  1,
);

{
  const f = { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар", "Москва"], dealerIds: ["d-1"] };
  assert.equal(applyDistributionAnalyticsFilters(rows, f, shMap, act, catalogLookup).length, 1);
}

{
  const original = {
    ...emptyDistributionAnalyticsFilters(),
    cities: ["Краснодар"],
    clientCategories: ["top150" as const],
    modelIds: ["m-a"],
  };
  const encoded = serializeFilters(original);
  const decoded = deserializeFilters(encoded);
  assert.deepEqual(decoded.cities, original.cities);
  assert.deepEqual(decoded.clientCategories, original.clientCategories);
  assert.deepEqual(decoded.modelIds, original.modelIds);
}

console.log("distribution-analytics-view-models: ok");
