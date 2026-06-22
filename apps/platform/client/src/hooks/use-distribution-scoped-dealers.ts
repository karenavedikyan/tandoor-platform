import { useEffect, useMemo } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  buildDistributionScopedDealerRows,
  buildDistributionWorkingDealerRows,
} from "@/lib/distribution-entry-scoped-rows";
import {
  flattenTradePointsForRows,
  type TradePointListRow,
} from "@/lib/dealer-base-management-view-model";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { useAuthUser } from "@/hooks/use-auth-user";

/** Admin/director (→ sales_director profile) and category_manager (platform role) see full working catalog. */
function isDistributionFullView(profile: ReleaseDemoProfile, authRole?: string): boolean {
  if (profile.role === "sales_director") return true;
  return authRole === "category_manager";
}

export function useDistributionScopedDealers(profile: ReleaseDemoProfile): DealerRow[] {
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const realScope = useSidebarNavRealScope();
  const { user } = useAuthUser();

  const isFullView = isDistributionFullView(profile, user?.role);

  const scoped = useMemo(() => {
    const releaseDealerRows = realScope.ready ? realScope.releaseDealerRows : undefined;
    if (isFullView) {
      return buildDistributionWorkingDealerRows(profile, {
        actualizationEnabled: actx.enabled,
        mergedState: managementPlane.mergedState,
        releaseDealerRows,
      });
    }
    return buildDistributionScopedDealerRows(profile, {
      actualizationEnabled: actx.enabled,
      mergedState: managementPlane.mergedState,
      realScope,
      releaseDealerRows,
    });
  }, [actx.enabled, managementPlane.mergedState, profile, realScope, isFullView]);

  useEffect(() => {
    if (user?.role !== "regional_manager") return;
    console.debug("[rm-scope] useDistributionScopedDealers", {
      ready: realScope.ready,
      access: realScope.orgScope?.access,
      releaseDealerRows: realScope.releaseDealerRows?.length ?? 0,
      scopedDealers: scoped.length,
      actualizationEnabled: actx.enabled,
    });
  }, [user?.role, realScope, scoped.length, actx.enabled]);

  return scoped;
}

export function useDistributionScopedTradePoints(profile: ReleaseDemoProfile): TradePointListRow[] {
  const scoped = useDistributionScopedDealers(profile);
  const { user } = useAuthUser();
  const tradePoints = useMemo(() => flattenTradePointsForRows(scoped), [scoped]);

  useEffect(() => {
    if (user?.role !== "regional_manager") return;
    console.debug("[rm-scope] useDistributionScopedTradePoints", {
      scopedDealers: scoped.length,
      tradePoints: tradePoints.length,
    });
  }, [user?.role, scoped.length, tradePoints.length]);

  return tradePoints;
}
