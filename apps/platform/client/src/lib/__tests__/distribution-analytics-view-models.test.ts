/**
 * Запуск: `npm run test:distribution-analytics-view-models` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { ActualizationState } from "../client-base-actualization-state";
import type { DealerRow, DealerTradePoint } from "../dealer-base-mock-data";
import type { MergedTradePointEntry } from "../dealer-trade-points-overrides";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api";
import type { TradePointListRow } from "../trade-point-list-for-actualization";
import {
  applyDistributionAnalyticsFilters,
  deserializeFilters,
  emptyDistributionAnalyticsFilters,
  serializeFilters,
} from "../distribution-analytics/distribution-analytics-filters";
import {
  buildAnalyticsTradePointRows,
  buildDistributionAnalyticsData,
  buildProductAnalyticsRows,
  collectAnalyticsCatalogProducts,
} from "../distribution-analytics/distribution-analytics-view-models";

function makeInstalledModel(targetId: string, tradePointId: string): ShowcaseMatrixEntryDto {
  return {
    id: `m-${targetId}-${tradePointId}`,
    dealerId: "d",
    tradePointId,
    targetKind: "model",
    targetId,
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
  };
}

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
const installedEntriesByTradePointId: Record<string, ShowcaseMatrixEntryDto[]> = {
  "tp-1": [makeInstalledModel("m-a", "tp-1")],
  "tp-2": [],
};

assert.equal(applyDistributionAnalyticsFilters(rows, emptyDistributionAnalyticsFilters(), shMap, act, installedEntriesByTradePointId).length, 2);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), dealerIds: ["d-2"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), tradePointIds: ["tp-1"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), clientCategories: ["top350"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), managerIds: ["Иванов"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), equipmentTypes: ["entrance"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), equipmentTypes: ["interior"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(rows, { ...emptyDistributionAnalyticsFilters(), modelIds: ["m-a"] }, shMap, act, installedEntriesByTradePointId).length,
  1,
);

assert.equal(
  applyDistributionAnalyticsFilters(
    rows,
    { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар"], clientCategories: ["top150"], equipmentTypes: ["entrance"] },
    shMap,
    act,
    installedEntriesByTradePointId,
  ).length,
  1,
);

{
  const f = { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар", "Москва"], dealerIds: ["d-1"] };
  assert.equal(applyDistributionAnalyticsFilters(rows, f, shMap, act, installedEntriesByTradePointId).length, 1);
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

{
  const matrixTpId = "tp-matrix";
  const matrixAct = {
    tradePointShowcaseActualizationById: {
      [matrixTpId]: {
        tradePointId: matrixTpId,
        dealerId: "d-m",
        hasShowcase: true,
        entrancePortals: 8,
        interiorPortals: 12,
        hardwareSections: 10,
        selectedShowcaseModels: [],
      },
    },
    dealerOverridesById: {},
  } as unknown as ActualizationState;
  const matrixRow = makeRow({ tradePointId: matrixTpId, dealerId: "d-m", city: "Джанкой" });
  const matrixInstalled: Record<string, ShowcaseMatrixEntryDto[]> = {
    [matrixTpId]: [
      ...Array.from({ length: 8 }, (_, i) => makeInstalledModel(`tc-vh-installed-${i}`, matrixTpId)),
      ...Array.from({ length: 12 }, (_, i) => makeInstalledModel(`tc-mk-installed-${i}`, matrixTpId)),
      ...Array.from({ length: 10 }, (_, i) => makeInstalledModel(`tc-hw-installed-${i}`, matrixTpId)),
    ],
  };
  const tpRows = buildAnalyticsTradePointRows([matrixRow], matrixAct.tradePointShowcaseActualizationById, matrixInstalled);
  assert.equal(tpRows[0]!.metrics.byType.entrance.tandoorOnShelf, 8);
  assert.equal(tpRows[0]!.metrics.byType.interior.tandoorOnShelf, 12);
  assert.equal(tpRows[0]!.metrics.byType.hardware.tandoorOnShelf, 10);
  assert.equal(tpRows[0]!.metrics.byType.entrance.percent, 100);

  const data = buildDistributionAnalyticsData({
    scopedRows: [matrixRow],
    filters: emptyDistributionAnalyticsFilters(),
    act: matrixAct,
    installedEntriesByTradePointId: matrixInstalled,
  });
  assert.ok((data.groupAggregate.byType.entrance.percent ?? 0) > 0);
  assert.ok((data.groupAggregate.byType.interior.percent ?? 0) > 0);
  assert.ok((data.groupAggregate.byType.hardware.percent ?? 0) > 0);

  const products = collectAnalyticsCatalogProducts();
  const targetProduct = products.find((p) => p.id === "tc-vh-installed-0");
  if (targetProduct) {
    const productRows = buildProductAnalyticsRows(
      [targetProduct],
      tpRows,
      matrixInstalled,
      () => tpRows,
    );
    assert.equal(productRows[0]!.coverage.presentTradePoints, 1);
    assert.equal(productRows[0]!.coverage.coveragePercent, 100);
  }
}

console.log("distribution-analytics-view-models: ok");
