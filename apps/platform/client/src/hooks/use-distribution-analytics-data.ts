import { useMemo, useRef } from "react";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useDistributionScopedDealers } from "@/hooks/use-distribution-scoped-dealers";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { getProductById } from "@/lib/catalog-data";
import {
  buildDistributionAnalyticsData,
  buildScopedAnalyticsTradePointRows,
  type DistributionAnalyticsData,
} from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DistributionAnalyticsFilters } from "@/lib/distribution-analytics/distribution-analytics-filters";
import {
  DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD,
  hasAnyDistributionAnalyticsFilters,
} from "@/lib/distribution-analytics/distribution-analytics-filters";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";

function diagSizeOf(v: unknown): number | string {
  if (Array.isArray(v)) return v.length;
  if (v instanceof Set) return v.size;
  if (v && typeof v === "object") return Object.keys(v).length;
  return typeof v;
}

const EMPTY_GROUP_AGGREGATE: DistributionAnalyticsData["groupAggregate"] = {
  byType: {
    entrance: { capacity: 0, tandoorOnShelf: 0, percent: null },
    interior: { capacity: 0, tandoorOnShelf: 0, percent: null },
    hardware: { capacity: 0, tandoorOnShelf: 0, percent: null },
  },
  averagePercent: null,
  tradePointsCount: 0,
};

const EMPTY_DISTRIBUTION_ANALYTICS_DATA: DistributionAnalyticsData = {
  filteredRows: [],
  tradePointRows: [],
  metricsByTradePointId: {},
  groupAggregate: EMPTY_GROUP_AGGREGATE,
  modelCoverageByModelId: {},
  productRows: [],
  territoryRows: [],
};

export function useDistributionAnalyticsData(
  profile: ReleaseDemoProfile,
  filters: DistributionAnalyticsFilters,
): DistributionAnalyticsData {
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const realScope = useSidebarNavRealScope();
  const scopedDealers = useDistributionScopedDealers(profile);

  const mergedState = managementPlane.mergedState;
  const act = actx.enabled ? mergedState : actx.state;
  const tradePointShowcaseActualizationById = act.tradePointShowcaseActualizationById;
  const scopeTooLarge =
    scopedDealers.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD &&
    !hasAnyDistributionAnalyticsFilters(filters);

  const refDiag = useRef<Record<string, unknown>>({});
  const check = (key: string, value: unknown): "same" | "NEW" => {
    const prev = refDiag.current[key];
    refDiag.current[key] = value;
    return prev === value ? "same" : "NEW";
  };

  if (typeof window !== "undefined") {
    const scopeWithRows = realScope as SidebarNavRealScope & { releaseDealerRows?: unknown[] };
    // eslint-disable-next-line no-console
    console.log("[diag-441b] inputs", {
      realScope: check("realScope", realScope),
      "realScope.size": diagSizeOf(scopeWithRows.releaseDealerRows ?? realScope),
      scopedDealers: check("scopedDealers", scopedDealers),
      "scopedDealers.len": diagSizeOf(scopedDealers),
      profile: check("profile", profile),
      tpActualization: check("tpActualization", tradePointShowcaseActualizationById),
      "tpActualization.size": diagSizeOf(tradePointShowcaseActualizationById),
      productById: check("productById", getProductById),
      act: check("act", act),
      mergedState: check("mergedState", mergedState),
      filters: check("filters", filters),
      "filters.json": filters ? JSON.stringify(filters).slice(0, 200) : null,
    });
  }

  const scopedRowsDepsRef = useRef<Record<string, unknown>>({});
  if (typeof window !== "undefined") {
    const prev = scopedRowsDepsRef.current;
    const next = { act, profile, scopedDealers, realScope };
    const changed: string[] = [];
    for (const k of Object.keys(next) as (keyof typeof next)[]) {
      if (prev[k] !== next[k]) changed.push(k);
    }
    scopedRowsDepsRef.current = next;
    if (changed.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[diag-441b] scopedRows useMemo deps changed=[${changed.join(",")}]`);
    }
  }

  const scopedRows = useMemo(
    () =>
      scopeTooLarge
        ? []
        : buildScopedAnalyticsTradePointRows(act, profile, scopedDealers, realScope),
    [scopeTooLarge, act, profile, scopedDealers, realScope],
  );

  const dataDepsRef = useRef<Record<string, unknown>>({});
  if (typeof window !== "undefined") {
    const prev = dataDepsRef.current;
    const next = { scopedRows, filters, act };
    const changed: string[] = [];
    for (const k of Object.keys(next) as (keyof typeof next)[]) {
      if (prev[k] !== next[k]) changed.push(k);
    }
    dataDepsRef.current = next;
    if (changed.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[diag-441b] analyticsData useMemo deps changed=[${changed.join(",")}]`);
    }
  }

  return useMemo(
    () =>
      scopeTooLarge
        ? EMPTY_DISTRIBUTION_ANALYTICS_DATA
        : buildDistributionAnalyticsData({
            scopedRows,
            filters,
            act,
            catalogLookup: getProductById,
          }),
    [scopeTooLarge, scopedRows, filters, act],
  );
}
