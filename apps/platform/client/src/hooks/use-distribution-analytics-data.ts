import { useMemo, useRef } from "react";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useDistributionScopedDealers } from "@/hooks/use-distribution-scoped-dealers";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { CATALOG_PRODUCTS, getProductById } from "@/lib/catalog-data";
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
  const tradePointShowcaseActualizationById = act.tradePointShowcaseActualizationById;

  const prevRefs = useRef<{
    realScope?: unknown;
    dealers?: unknown;
    tradePointShowcaseActualizationById?: unknown;
    productById?: unknown;
    act?: unknown;
    filters?: unknown;
  }>({});
  const refDiag = (key: keyof typeof prevRefs.current, value: unknown) => {
    const same = prevRefs.current[key] === value;
    prevRefs.current[key] = value;
    return same ? "same" : "NEW";
  };
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[diag-441] deps:", {
      realScope: refDiag("realScope", realScope),
      dealers: refDiag("dealers", scopedDealers),
      tpActualization: refDiag("tradePointShowcaseActualizationById", tradePointShowcaseActualizationById),
      productById: refDiag("productById", getProductById),
      act: refDiag("act", act),
      filters: refDiag("filters", filters),
    });
  }

  const datasetLoggedRef = useRef(false);
  if (typeof window !== "undefined" && !datasetLoggedRef.current && scopedDealers.length > 0) {
    datasetLoggedRef.current = true;
    const tpCount = scopedDealers.reduce((acc, d) => acc + (d.tradePoints?.length ?? 0), 0);
    // eslint-disable-next-line no-console
    console.log("[diag-441] dataset:", {
      dealersCount: scopedDealers.length,
      tradePointsCount: tpCount,
      productsCount: CATALOG_PRODUCTS.length,
    });
  }

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
