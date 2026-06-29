/**
 * Промт 440: analytics page must not crash on empty scoped data.
 * Запуск: `npm run test:distribution-analytics-empty` из apps/platform.
 *
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

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({ user: { role: "director" }, isLoading: false, isError: false }),
}));

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => [],
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
  useSidebarNavRealScope: () => ({ isRealUser: false, loading: false, ready: false }),
}));

describe("DistributionAnalyticsPage empty scope (440)", () => {
  it("renders empty state without crashing", () => {
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

    expect(screen.getByTestId("page-distribution-analytics")).toBeTruthy();
    expect(screen.getByTestId("distribution-analytics-empty-scope")).toBeTruthy();
    expect(screen.getByText("Нет ТТ в вашей зоне ответственности.")).toBeTruthy();
  });
});
