/**
 * Промт 441-fix5: actStable prevents redundant analytics rebuilds.
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __clearDistributionScopePrefetchKeys } from "@/lib/distribution-scope-prefetch-guard";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import { emptyDistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { DistributionAnalyticsData } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ShowcaseMatrixEntryDto } from "@/lib/showcase-matrix-api";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";
import { useDistributionAnalyticsData } from "@/hooks/use-distribution-analytics-data";

const emptyAggregate = {
  byType: {
    entrance: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, legacyOurs: 0, percent: null, rotationPotentialPercent: null },
  },
  averagePercent: null,
  rotationPotentialPercent: null,
  totalLegacyOurs: 0,
  tradePointsCount: 0,
};

const analyticsResult: DistributionAnalyticsData = {
  filteredRows: [],
  tradePointRows: [],
  metricsByTradePointId: {},
  groupAggregate: emptyAggregate,
  modelCoverageByModelId: {},
  productRows: [],
  territoryRows: [],
  installedEntriesByTradePointId: {},
};

const buildAnalyticsDataMock = vi.hoisted(() => vi.fn(() => analyticsResult));
const scopedRowsResult = vi.hoisted(() => [] as TradePointListRow[]);
const buildScopedRowsMock = vi.hoisted(() => vi.fn(() => scopedRowsResult));

const fetchShowcaseMatrixScopeMock = vi.hoisted(() => vi.fn(async () => [] as ShowcaseMatrixEntryDto[]));
const loadCachedMatrixMock = vi.hoisted(() => vi.fn((_tradePointId?: string) => [] as ShowcaseMatrixEntryDto[]));
const applyScopeEntriesToMatrixCacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/distribution-analytics/distribution-analytics-view-models", () => ({
  buildDistributionAnalyticsData: buildAnalyticsDataMock,
  buildScopedAnalyticsTradePointRows: buildScopedRowsMock,
}));

vi.mock("@/lib/showcase-matrix-api", () => ({
  fetchShowcaseMatrixScope: fetchShowcaseMatrixScopeMock,
}));

vi.mock("@/lib/showcase-matrix-store", () => ({
  applyScopeEntriesToMatrixCache: applyScopeEntriesToMatrixCacheMock,
  loadCachedMatrix: loadCachedMatrixMock,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT: "showcase-matrix-store-changed",
}));

const SCOPED_DEALERS = vi.hoisted(() => [
  { id: "d1", name: "D1", city: "Краснодар", region: "Юг", tradePoints: [] } as DealerRow,
]);
const REAL_SCOPE = vi.hoisted(() => ({
  isRealUser: true,
  loading: false,
  ready: true,
  releaseDealerRows: SCOPED_DEALERS,
}));

let mockAct = createEmptyActualizationState();
let mockActx = {
  enabled: false,
  loading: false,
  state: mockAct,
  persist: vi.fn(),
  refresh: vi.fn(),
};
let mockTeam = { mergedState: mockAct };

vi.mock("@/context/client-base-actualization-context", () => ({
  useClientBaseActualization: () => mockActx,
}));

vi.mock("@/context/client-base-team-actualization-context", () => ({
  useClientBaseTeamActualization: () => mockTeam,
}));

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => SCOPED_DEALERS,
}));

vi.mock("@/hooks/use-sidebar-nav-real-scope", () => ({
  useSidebarNavRealScope: () => REAL_SCOPE,
}));

function cloneAct(state: ActualizationState): ActualizationState {
  return {
    ...state,
    dealerOverridesById: { ...state.dealerOverridesById },
    tradePointShowcaseActualizationById: { ...state.tradePointShowcaseActualizationById },
  };
}

function makeScopedRow(tradePointId: string): TradePointListRow {
  return {
    tradePointId,
    dealerId: "d1",
    city: "Краснодар",
    clientCategory: "top150",
    hasShowcase: true,
  } as TradePointListRow;
}

describe("useDistributionAnalyticsData actStable (441-fix5)", () => {
  const profile = { role: "sales_director" as const, personaUserId: "dir-1" };
  const filters = { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар"] };

  beforeEach(() => {
    __clearDistributionScopePrefetchKeys();
    buildAnalyticsDataMock.mockClear();
    buildScopedRowsMock.mockClear();
    fetchShowcaseMatrixScopeMock.mockClear();
    loadCachedMatrixMock.mockClear();
    applyScopeEntriesToMatrixCacheMock.mockClear();
    scopedRowsResult.length = 0;
    fetchShowcaseMatrixScopeMock.mockResolvedValue([]);
    loadCachedMatrixMock.mockReturnValue([]);
    mockAct = createEmptyActualizationState();
    mockAct.updatedAt = "2026-01-01T00:00:00.000Z";
    mockActx = {
      enabled: false,
      loading: false,
      state: mockAct,
      persist: vi.fn(),
      refresh: vi.fn(),
    };
    mockTeam = { mergedState: mockAct };
  });

  it("does not rebuild analytics when act identity changes but content key is unchanged", () => {
    const { rerender } = renderHook(() => useDistributionAnalyticsData(profile, filters));
    expect(buildAnalyticsDataMock).toHaveBeenCalledTimes(1);

    const nextAct = cloneAct(mockAct);
    mockActx = { ...mockActx, state: nextAct };
    rerender();
    expect(buildAnalyticsDataMock).toHaveBeenCalledTimes(1);
  });

  it("rebuilds analytics when act content key changes", () => {
    const { rerender } = renderHook(() => useDistributionAnalyticsData(profile, filters));
    expect(buildAnalyticsDataMock).toHaveBeenCalledTimes(1);

    const nextAct = cloneAct(mockAct);
    nextAct.updatedAt = "2026-01-02T00:00:00.000Z";
    mockActx = { ...mockActx, state: nextAct };
    rerender();
    expect(buildAnalyticsDataMock).toHaveBeenCalledTimes(2);
  });
});

describe("useDistributionAnalyticsData matrix prefetch", () => {
  const profile = { role: "sales_director" as const, personaUserId: "dir-1" };
  const filters = emptyDistributionAnalyticsFilters();

  beforeEach(() => {
    __clearDistributionScopePrefetchKeys();
    buildAnalyticsDataMock.mockClear();
    buildScopedRowsMock.mockReset();
    buildScopedRowsMock.mockReturnValue(scopedRowsResult);
    fetchShowcaseMatrixScopeMock.mockClear();
    loadCachedMatrixMock.mockClear();
    applyScopeEntriesToMatrixCacheMock.mockClear();
    scopedRowsResult.length = 0;
    scopedRowsResult.push(makeScopedRow("tp-1"));
    fetchShowcaseMatrixScopeMock.mockResolvedValue([]);
    loadCachedMatrixMock.mockReturnValue([]);
    mockAct = createEmptyActualizationState();
    mockActx = {
      enabled: false,
      loading: false,
      state: mockAct,
      persist: vi.fn(),
      refresh: vi.fn(),
    };
    mockTeam = { mergedState: mockAct };
  });

  it("does not refetch scope after matrix store changed event", async () => {
    const { rerender } = renderHook(() => useDistributionAnalyticsData(profile, filters));

    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event("showcase-matrix-store-changed"));
    });
    rerender();

    expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalledTimes(1);
  });

  it("refetches once when scoped dealers change", async () => {
    buildScopedRowsMock.mockReturnValue([makeScopedRow("tp-1")]);
    const { rerender } = renderHook(() => useDistributionAnalyticsData(profile, filters));

    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalledTimes(1);
    });

    buildScopedRowsMock.mockReturnValue([makeScopedRow("tp-2")]);
    const nextAct = cloneAct(mockAct);
    nextAct.updatedAt = "2026-01-02T00:00:00.000Z";
    mockActx = { ...mockActx, state: nextAct };
    mockTeam = { mergedState: nextAct };
    rerender();

    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalledTimes(2);
    });
  });

  it("prefetches installed matrix and rebuilds analytics with cached entries", async () => {
    const installedEntry: ShowcaseMatrixEntryDto = {
      id: "e1",
      dealerId: "d1",
      tradePointId: "tp-1",
      targetKind: "model",
      targetId: "tc-vh-model-1",
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
      placementLegacyOurs: null,
    };
    fetchShowcaseMatrixScopeMock.mockResolvedValue([installedEntry]);
    loadCachedMatrixMock.mockImplementation((tpId: string) => (tpId === "tp-1" ? [installedEntry] : []));

    renderHook(() => useDistributionAnalyticsData(profile, filters));

    await waitFor(() => {
      expect(fetchShowcaseMatrixScopeMock).toHaveBeenCalledWith({
        tradePointIds: ["tp-1"],
        statuses: ["installed"],
      });
    });

    await waitFor(() => {
      expect(
        buildAnalyticsDataMock.mock.calls.some((call) => {
          const arg = (call as unknown[])[0] as {
            installedEntriesByTradePointId?: Record<string, ShowcaseMatrixEntryDto[]>;
          };
          return (arg.installedEntriesByTradePointId?.["tp-1"]?.length ?? 0) > 0;
        }),
      ).toBe(true);
    });
  });
});
