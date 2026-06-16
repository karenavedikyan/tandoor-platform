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

export function useDistributionScopedDealers(profile: ReleaseDemoProfile): DealerRow[] {
  const actx = useClientBaseActualization();
  const managementPlane = useClientBaseTeamActualization();

  return useMemo(
    () =>
      buildDistributionScopedDealerRows(profile, {
        actualizationEnabled: actx.enabled,
        mergedState: managementPlane.mergedState,
      }),
    [actx.enabled, managementPlane.mergedState, profile],
  );
}

export function useDistributionScopedTradePoints(profile: ReleaseDemoProfile): TradePointListRow[] {
  const scoped = useDistributionScopedDealers(profile);
  return useMemo(() => flattenTradePointsForRows(scoped), [scoped]);
}
