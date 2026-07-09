/**
 * Промт 441-fix2: large scope guard for admin/director analytics.
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import {
  DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD,
  emptyDistributionAnalyticsFilters,
  hasAnyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { DistributionAnalyticsData } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
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

function makeDealers(count: number): DealerRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `dealer-${i}`,
    name: `Dealer ${i}`,
    city: i % 2 === 0 ? "Москва" : "Казань",
    region: i % 2 === 0 ? "ЦФО" : "ПФО",
    releaseCode: `MA${String(i).padStart(4, "0")}`,
    tradePoints: [
      {
        id: `tp-${i}`,
        name: `ТТ ${i}`,
        city: i % 2 === 0 ? "Москва" : "Казань",
        address: "",
        format: "",
        status: "",
        equipment: "",
        hardwareStockStatus: "",
        doorsStockStatus: "",
        distribution: { mk: 0, vh: 0, total: 0 },
        showcaseStatus: "",
        showcaseNeeds: "",
        lastVisitDate: "",
        nextVisitDate: "",
        responsibleRegionalManager: "",
      },
    ],
  })) as DealerRow[];
}

vi.mock("@/hooks/use-distribution-analytics-data", () => ({
  useDistributionAnalyticsData: () => ({ ...emptyData, act: createEmptyActualizationState() }),
}));

vi.mock("@/hooks/use-distribution-analytics-data-1c", () => ({
  useDistributionAnalyticsData1c: () => ({ ...emptyData, act: createEmptyActualizationState() }),
}));

vi.mock("@/hooks/use-auth-user", () => ({
  useAuthUser: () => ({ user: { role: "director" }, isLoading: false, isError: false }),
}));

const mockScopedDealers = vi.fn(() => [] as DealerRow[]);
const mockOneCDealers = vi.fn(() => [] as DealerRow[]);

vi.mock("@/hooks/use-distribution-scoped-dealers", () => ({
  useDistributionScopedDealers: () => mockScopedDealers(),
}));

vi.mock("@/hooks/use-one-c-scoped-stores", () => ({
  useOneCScopedStores: () => ({
    items: [],
    dealers: mockOneCDealers(),
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
    mockOneCDealers.mockReset();
    mockOneCDealers.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows scope-too-large empty state when dealers exceed threshold without filters", () => {
    const dealerCount = DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD + 1;
    mockOneCDealers.mockReturnValue(makeDealers(dealerCount));
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
    expect(screen.getByText(new RegExp(`${dealerCount} дилеров`))).toBeTruthy();
  });

  it("does not show scope-too-large when filters are applied", () => {
    mockOneCDealers.mockReturnValue(makeDealers(DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD + 1));
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
