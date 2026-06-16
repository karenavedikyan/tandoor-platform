import { useMemo } from "react";
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
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

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

  const scopedRows = useMemo(
    () => buildScopedAnalyticsTradePointRows(act, profile, scopedDealers, realScope),
    [act, profile, scopedDealers, realScope],
  );

  return useMemo(
    () =>
      buildDistributionAnalyticsData({
        scopedRows,
        filters,
        act,
        catalogLookup: getProductById,
      }),
    [scopedRows, filters, act],
  );
}
