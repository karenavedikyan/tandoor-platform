/**
 * Промт 441-fix5: actStable prevents redundant analytics rebuilds.
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyActualizationState, type ActualizationState } from "@/lib/client-base-actualization-state";
import { emptyDistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { DistributionAnalyticsData } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { useDistributionAnalyticsData } from "@/hooks/use-distribution-analytics-data";

const emptyAggregate = {
  byType: {
    entrance: { capacity: 0, tandoorOnShelf: 0, percent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, percent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, percent: null },
  },
  averagePercent: null,
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
};

const buildAnalyticsDataMock = vi.hoisted(() => vi.fn(() => analyticsResult));
const scopedRowsResult = vi.hoisted(() => [] as never[]);
const buildScopedRowsMock = vi.hoisted(() => vi.fn(() => scopedRowsResult));

vi.mock("@/lib/distribution-analytics/distribution-analytics-view-models", () => ({
  buildDistributionAnalyticsData: (...args: unknown[]) => buildAnalyticsDataMock(...args),
  buildScopedAnalyticsTradePointRows: (...args: unknown[]) => buildScopedRowsMock(...args),
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

describe("useDistributionAnalyticsData actStable (441-fix5)", () => {
  const profile = { role: "sales_director" as const, personaUserId: "dir-1" };
  const filters = { ...emptyDistributionAnalyticsFilters(), cities: ["Краснодар"] };

  beforeEach(() => {
    buildAnalyticsDataMock.mockClear();
    buildScopedRowsMock.mockClear();
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
