/**
 * Промт 441-fix2: large scope guard for admin/director analytics.
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import {
  emptyDistributionAnalyticsFilters,
  hasAnyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { DistributionAnalyticsData } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { DistributionAnalyticsPage } from "@/pages/distribution-analytics";

const emptyAggregate = {
  byType: {
    entrance: { capacity: 0, tandoorOnShelf: 0, percent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, percent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, percent: null },
  },
  averagePercent: null,
  tradePointsCount: 0,
};

const emptyData: DistributionAnalyticsData = {
  filteredRows: [],
  tradePointRows: [],
  metricsByTradePointId: {},
  groupAggregate: emptyAggregate,
  modelCoverageByModelId: {},
  productRows: [],
  territoryRows: [],
};

function makeDealers(count: number): DealerRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `dealer-${i}`,
    name: `Dealer ${i}`,
    city: "Москва",
    region: "ЦФО",
    tradePoints: [],
  })) as DealerRow[];
}

vi.mock("@/hooks/use-distribution-analytics-data", () => ({
  useDistributionAnalyticsData: () => emptyData,
}));

const mockScopedDealers = vi.fn(() => [] as DealerRow[]);

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => mockScopedDealers(),
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

vi.mock("@/hooks/use-sidebar-nav-real-scope", () => ({
  useSidebarNavRealScope: () => ({ isRealUser: true, loading: false, ready: true, releaseDealerRows: [] }),
}));

describe("DistributionAnalyticsPage large scope guard (441-fix2)", () => {
  beforeEach(() => {
    mockScopedDealers.mockReset();
    mockScopedDealers.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows scope-too-large empty state when dealers exceed threshold without filters", () => {
    mockScopedDealers.mockReturnValue(makeDealers(801));
    render(
      <DistributionAnalyticsPage
        profile={{ role: "sales_director", personaUserId: "dir-1" }}
        tab="trade-points"
        filters={emptyDistributionAnalyticsFilters()}
        filtersEncoded=""
        onTabChange={() => undefined}
        onFiltersChange={() => undefined}
      />,
    );

    expect(screen.getByTestId("distribution-analytics-scope-too-large")).toBeTruthy();
    expect(screen.getByText("Слишком большой scope")).toBeTruthy();
    expect(screen.getByText(/801 дилеров/)).toBeTruthy();
  });

  it("does not show scope-too-large when filters are applied", () => {
    mockScopedDealers.mockReturnValue(makeDealers(801));
    const filters = { ...emptyDistributionAnalyticsFilters(), regions: ["ЦФО"] };
    expect(hasAnyDistributionAnalyticsFilters(filters)).toBe(true);
    render(
      <DistributionAnalyticsPage
        profile={{ role: "sales_director", personaUserId: "dir-1" }}
        tab="trade-points"
        filters={filters}
        filtersEncoded=""
        onTabChange={() => undefined}
        onFiltersChange={() => undefined}
      />,
    );

    expect(screen.queryByTestId("distribution-analytics-scope-too-large")).toBeNull();
    expect(screen.getByTestId("distribution-analytics-empty-scope")).toBeTruthy();
  });
});
