/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import { emptyDistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { DistributionAnalyticsData } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import { DistributionAnalyticsPage } from "@/pages/distribution-analytics";

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

const emptyData: DistributionAnalyticsData = {
  filteredRows: [],
  tradePointRows: [],
  metricsByTradePointId: {},
  groupAggregate: emptyAggregate,
  modelCoverageByModelId: {},
  productRows: [],
  territoryRows: [],
  installedEntriesByTradePointId: {},
};

vi.mock("@/hooks/use-distribution-analytics-data", () => ({
  useDistributionAnalyticsData: () => ({ ...emptyData, act: createEmptyActualizationState() }),
}));

vi.mock("@/hooks/use-distribution-analytics-data-1c", () => ({
  useDistributionAnalyticsData1c: () => ({ ...emptyData, act: createEmptyActualizationState() }),
}));

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({ user: { role: "manager" }, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => [],
}));

vi.mock("@/hooks/use-one-c-scoped-stores", () => ({
  useOneCScopedStores: () => ({
    items: [],
    dealers: [],
    tradePoints: [],
    rowRefs: new Map(),
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock("@/lib/use-org-snapshot", () => ({
  useOrgSnapshot: () => ({ data: null, isLoading: false }),
}));

describe("DistributionAnalyticsPage source routing", () => {
  it("renders 1C analytics banner for non-admin", () => {
    render(
      <DistributionAnalyticsPage
        profile={{ role: "sales_manager", personaUserId: "mgr-1" }}
        tab="trade-points"
        filters={emptyDistributionAnalyticsFilters()}
        filtersEncoded=""
        onTabChange={() => undefined}
        onFiltersChange={() => undefined}
      />,
    );

    expect(screen.getByTestId("page-distribution-analytics").getAttribute("data-analytics-source")).toBe("one-c");
    expect(screen.getByText("Аналитика построена на данных 1С-витрины.")).toBeTruthy();
  });
});
