import { buildDealerBaseRowsWithActualization } from "./client-base-actualization-data-merge.js";
import type { ActualizationState } from "./client-base-actualization-state.js";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { getCatalogDealerRows } from "./dealer-base-source.js";
import { distributionEntryScopedDealerRows } from "./distribution-entry-dealer-scope.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import type { SidebarNavRealScope } from "./sidebar-nav-real-scope.js";

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
            releaseDealerRows: options.releaseDealerRows,
    });
  }
  if (options.releaseDealerRows && options.releaseDealerRows.length > 0) {
    return options.releaseDealerRows;
  }
  return getCatalogDealerRows();
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
