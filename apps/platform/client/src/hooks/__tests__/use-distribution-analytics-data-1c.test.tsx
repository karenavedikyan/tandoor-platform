/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import { emptyDistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { DistributionTradePointMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

const ONE_C_TP_ID = "000afc6c-7ca4-11ef-8134-00155d0a0a4e";
const ONE_C_LEGAL_ID = "27bfa4e6-3d83-11e8-8153-00155d0a732a";

const metrics: DistributionTradePointMetrics = {
  tradePointId: ONE_C_TP_ID,
  hasShowcase: true,
  byType: {
    entrance: { capacity: 4, tandoorOnShelf: 2, legacyOurs: 2, percent: 50, rotationPotentialPercent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
  },
  averagePercent: 50,
  rotationPotentialPercent: null,
};

const storeItem: OneCStoreListItem = {
  id_1c: ONE_C_TP_ID,
  address: "ул. Тестовая, 1",
  manager_name: "Менеджер 1С",
  legal_name: "ООО Тест",
  legal_inn: "1234567890",
  legal_city: "Краснодар",
  legal_parent_1c: ONE_C_LEGAL_ID,
  legal_parent_name: "ООО Тест",
  legal_client_type: "ТОП 150",
  legal_regional_manager_name: "РМ Тест",
  legal_responsible_manager_name: "Ответственный",
  legal_furniture_manager_name: null,
  rop_user_id: null,
  rop_name: "РОП Тест",
  legal_payment_form: null,
  legal_phone: null,
  legal_email: null,
  status: "active",
  orders_count: 0,
  distribution_filled: 2,
  distribution_total: 4,
};

const dealer = { id: ONE_C_LEGAL_ID, name: "ООО Тест", clientCategory: "top150" } as DealerRow;
const scopedRow = {
  tradePointId: ONE_C_TP_ID,
  dealerId: ONE_C_LEGAL_ID,
  city: "Краснодар",
  clientCategory: "top150",
} as TradePointListRow;

const buildFromScopedMock = vi.hoisted(() =>
  vi.fn(() => ({
    filteredRows: [scopedRow],
    tradePointRows: [{ row: scopedRow, metrics }],
    metricsByTradePointId: { [ONE_C_TP_ID]: metrics },
    groupAggregate: {
      byType: metrics.byType,
      averagePercent: 50,
      rotationPotentialPercent: null,
      totalLegacyOurs: 2,
      tradePointsCount: 1,
    },
    modelCoverageByModelId: {},
    productRows: [],
    territoryRows: [],
    installedEntriesByTradePointId: { [ONE_C_TP_ID]: [] },
  })),
);

vi.mock("@/lib/distribution-analytics/distribution-analytics-view-models", () => ({
  buildDistributionAnalyticsDataFromScoped: buildFromScopedMock,
}));

vi.mock("@/hooks/use-one-c-scoped-stores", () => ({
  useOneCScopedStores: () => ({
    items: [storeItem],
    dealers: [dealer],
    tradePoints: [],
    rowRefs: new Map(),
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("@/pages/one-c/use-one-c-stores-distribution-map", () => ({
  useOneCStoresDistributionMap: () => ({
    map: new Map([[ONE_C_TP_ID, metrics]]),
    loading: false,
  }),
}));

vi.mock("@/hooks/use-trade-point-showcase-shared-store", () => ({
  useTradePointShowcaseSharedStore: () => ({
    ready: true,
    recordByTradePointId: {},
  }),
}));

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => ({
    enabled: false,
    loading: false,
    state: createEmptyActualizationState(),
    persist: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => ({ mergedState: createEmptyActualizationState() }),
}));

vi.mock("@/lib/showcase-matrix-store", () => ({
  loadCachedMatrix: () => [],
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT: "showcase-matrix-store-changed",
}));

describe("useDistributionAnalyticsData1c", () => {
  beforeEach(() => {
    buildFromScopedMock.mockClear();
  });

  it("builds analytics from 1C scoped rows and metrics map", async () => {
    const { useDistributionAnalyticsData1c } = await import("@/hooks/use-distribution-analytics-data-1c");
    const { result } = renderHook(() => useDistributionAnalyticsData1c(emptyDistributionAnalyticsFilters()));

    expect(buildFromScopedMock).toHaveBeenCalled();
    const call = buildFromScopedMock.mock.calls[0]?.[0];
    expect(call?.scopedRows[0]?.tradePointId).toBe(ONE_C_TP_ID);
    expect(call?.metricsByTradePointId[ONE_C_TP_ID]).toEqual(metrics);
    expect(result.current.tradePointRows[0]?.row.tradePointId).toBe(ONE_C_TP_ID);
    expect(result.current.groupAggregate.tradePointsCount).toBe(1);
  });
});
