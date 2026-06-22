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

  const actContentKey = useMemo(() => {
    const tp = act.tradePointShowcaseActualizationById;
    const ov = act.dealerOverridesById;
    return [
      act.updatedAt ?? "",
      tp ? Object.keys(tp).length : 0,
      ov ? Object.keys(ov).length : 0,
    ].join("|");
  }, [act.updatedAt, act.tradePointShowcaseActualizationById, act.dealerOverridesById]);

  const actStableRef = useRef(act);
  const actKeyRef = useRef(actContentKey);
  if (actKeyRef.current !== actContentKey) {
    actKeyRef.current = actContentKey;
    actStableRef.current = act;
  }
  const actStable = actStableRef.current;

  const scopeTooLarge =
    scopedDealers.length > DISTRIBUTION_ANALYTICS_TOO_LARGE_SCOPE_THRESHOLD &&
    !hasAnyDistributionAnalyticsFilters(filters);

  const scopedRows = useMemo(
    () =>
      scopeTooLarge
        ? []
        : buildScopedAnalyticsTradePointRows(actStable, profile, scopedDealers, realScope),
    [scopeTooLarge, actStable, profile, scopedDealers, realScope],
  );

  return useMemo(
    () =>
      scopeTooLarge
        ? EMPTY_DISTRIBUTION_ANALYTICS_DATA
        : buildDistributionAnalyticsData({
            scopedRows,
            filters,
            act: actStable,
            catalogLookup: getProductById,
          }),
    [scopeTooLarge, scopedRows, filters, actStable],
  );
}
