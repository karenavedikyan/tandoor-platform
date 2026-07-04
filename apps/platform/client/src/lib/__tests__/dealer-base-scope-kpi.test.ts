import { describe, expect, it } from "vitest";
import type { DistributionGroupMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import { augmentDealerRowsWithScopePlaceholders } from "@/lib/dealer-base-source";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  isScopeDistributionKpiLoading,
  resolveKpiAverageDistributionDisplay,
  resolveKpiTradePointsDisplay,
  resolveScopeTradePointsCount,
} from "@/lib/dealer-base-scope-kpi";

const aggregate: DistributionGroupMetrics = {
  byType: {
    entrance: { capacity: 75, tandoorOnShelf: 36, legacyOurs: 0, percent: 48, rotationPotentialPercent: null },
    interior: { capacity: 371, tandoorOnShelf: 103, legacyOurs: 0, percent: 28, rotationPotentialPercent: null },
    hardware: { capacity: 10, tandoorOnShelf: 2, legacyOurs: 0, percent: 20, rotationPotentialPercent: null },
  },
  averagePercent: 32,
  rotationPotentialPercent: 19,
  totalLegacyOurs: 5,
  tradePointsCount: 1103,
};

function readyDbScope(totals: { active_dealers: number; active_trade_points: number }) {
  return {
    ready: true,
    totals: {
      active_dealers: totals.active_dealers,
      active_trade_points: totals.active_trade_points,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: totals.active_dealers,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
    },
    scope_explanation: { full_catalog: false },
    activeDealerExternalKeySet: new Set<string>(),
    trashedDealerExternalKeySet: new Set<string>(),
    active_dealer_external_keys: [],
    trashed_dealer_external_keys: [],
    scopeSubject: { id: "rm-1", role: "regional_manager" as const, full_name: "RM" },
  };
}

const emptyScope = {
  ready: false,
  totals: {
    active_dealers: 0,
    active_trade_points: 0,
    trashed_dealers: 0,
    trashed_trade_points: 0,
    tp_status_active: 0,
    tp_status_potential: 0,
    tp_status_attention: 0,
    dealer_no_status: 0,
    avg_distribution: 0,
  },
  scope_explanation: { full_catalog: false },
  activeDealerExternalKeySet: new Set<string>(),
  trashedDealerExternalKeySet: new Set<string>(),
  active_dealer_external_keys: [],
  trashed_dealer_external_keys: [],
  scopeSubject: { id: "", role: "manager" as const, full_name: "" },
};

describe("dealer-base scope KPI display", () => {
  it("regional_manager trade points count matches scope totals (sidebar source)", () => {
    const selfDbScopeQ = readyDbScope({ active_dealers: 1099, active_trade_points: 1103 });
    const count = resolveScopeTradePointsCount({
      useReal: true,
      viewingOtherUserScope: false,
      role: "regional_manager",
      targetScopeQ: emptyScope,
      orgScopeQ: { ready: false, data: null, isLoading: false, isError: false, error: null },
      teamScopeTotalsQ: { ready: false, data: null, isLoading: false, isError: false, error: null },
      selfDbScopeQ,
    });
    expect(count).toBe(1103);
    expect(
      resolveKpiTradePointsDisplay({
        scopeTradePointsCount: count,
        kpisReady: true,
        overviewTradePointsLoading: false,
        overviewTradePointsCount: 0,
        placeholder: "…",
      }),
    ).toBe("1103");
  });

  it("average distribution uses scope aggregate, not server avg_distribution zero", () => {
    expect(
      resolveKpiAverageDistributionDisplay({
        useReal: true,
        kpisReady: true,
        scopeDistributionLoading: false,
        scopeTradePointIdsReady: true,
        scopeDistributionTradePointsCount: 1103,
        aggregate,
        fallbackAvgDist: 0,
        placeholder: "…",
      }),
    ).toBe("32%");
  });

  it("shows placeholder while scope distribution is loading", () => {
    expect(
      isScopeDistributionKpiLoading({
        useReal: true,
        kpisReady: true,
        scopeDistributionLoading: true,
        scopeTradePointIdsReady: true,
        scopeDistributionTradePointsCount: 1103,
      }),
    ).toBe(true);
    expect(
      resolveKpiAverageDistributionDisplay({
        useReal: true,
        kpisReady: true,
        scopeDistributionLoading: true,
        scopeTradePointIdsReady: true,
        scopeDistributionTradePointsCount: 1103,
        aggregate,
        fallbackAvgDist: 0,
        placeholder: "…",
      }),
    ).toBe("…");
  });

  it("falls back to overview trade points when scope count unavailable", () => {
    expect(
      resolveKpiTradePointsDisplay({
        scopeTradePointsCount: null,
        kpisReady: true,
        overviewTradePointsLoading: false,
        overviewTradePointsCount: 42,
        placeholder: "…",
      }),
    ).toBe("42");
  });

  it("placeholder rows align showcase count with full scope dealer keys", () => {
    const catalog: DealerRow[] = [
      { id: "client-a", name: "A", city: "", region: "", clientCategory: "other", status: "активный" } as DealerRow,
      { id: "client-b", name: "B", city: "", region: "", clientCategory: "other", status: "активный" } as DealerRow,
    ];
    const scopeKeys = new Set(["client-a", "client-b", "client-c", "client-d"]);
    const rows = augmentDealerRowsWithScopePlaceholders(catalog, scopeKeys);
    expect(rows.length).toBe(4);
    expect(rows.filter((r) => r.id.startsWith("client-")).length).toBe(4);
  });
});
