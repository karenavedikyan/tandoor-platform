import { useMemo } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { buildDistributionScopedDealerRows } from "@/lib/distribution-entry-scoped-rows";
import {
  flattenTradePointsForRows,
  type TradePointListRow,
} from "@/lib/dealer-base-management-view-model";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";

export function useDistributionScopedDealers(profile: ReleaseDemoProfile): DealerRow[] {
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();
  const realScope = useSidebarNavRealScope();

  return useMemo(
    () =>
      buildDistributionScopedDealerRows(profile, {
        actualizationEnabled: actx.enabled,
        mergedState: managementPlane.mergedState,
        realScope,
        releaseDealerRows: realScope.ready ? realScope.releaseDealerRows : undefined,
      }),
    [actx.enabled, managementPlane.mergedState, profile, realScope],
  );
}

export function useDistributionScopedTradePoints(profile: ReleaseDemoProfile): TradePointListRow[] {
  const scoped = useDistributionScopedDealers(profile);
  return useMemo(() => flattenTradePointsForRows(scoped), [scoped]);
}
