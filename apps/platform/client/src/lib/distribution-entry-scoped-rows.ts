import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { distributionEntryScopedDealerRows } from "@/lib/distribution-entry-dealer-scope";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";

export function buildDistributionWorkingDealerRows(
  profile: ReleaseDemoProfile,
  options: {
    actualizationEnabled: boolean;
    mergedState: ActualizationState;
    releaseDealerRows?: DealerRow[];
  },
): DealerRow[] {
  if (options.actualizationEnabled) {
    return buildDealerBaseRowsWithActualization(options.mergedState, profile, {
      includeArchivedDealers: false,
      releaseDealerRows: options.releaseDealerRows,
    });
  }
  if (options.releaseDealerRows && options.releaseDealerRows.length > 0) {
    return options.releaseDealerRows;
  }
  return DEALER_BASE_ROWS;
}

export function buildDistributionScopedDealerRows(
  profile: ReleaseDemoProfile,
  options: {
    actualizationEnabled: boolean;
    mergedState: ActualizationState;
    realScope?: SidebarNavRealScope;
    releaseDealerRows?: DealerRow[];
  },
): DealerRow[] {
  const working = buildDistributionWorkingDealerRows(profile, {
    actualizationEnabled: options.actualizationEnabled,
    mergedState: options.mergedState,
    releaseDealerRows: options.releaseDealerRows,
  });
  return distributionEntryScopedDealerRows(working, profile, options.realScope);
}
