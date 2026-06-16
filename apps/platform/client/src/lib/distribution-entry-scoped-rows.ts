import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { distributionEntryScopedDealerRows } from "@/lib/distribution-entry-dealer-scope";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

export function buildDistributionWorkingDealerRows(
  profile: ReleaseDemoProfile,
  options: {
    actualizationEnabled: boolean;
    mergedState: ActualizationState;
  },
): DealerRow[] {
  if (options.actualizationEnabled) {
    return buildDealerBaseRowsWithActualization(options.mergedState, profile, {
      includeArchivedDealers: false,
    });
  }
  return DEALER_BASE_ROWS;
}

export function buildDistributionScopedDealerRows(
  profile: ReleaseDemoProfile,
  options: {
    actualizationEnabled: boolean;
    mergedState: ActualizationState;
  },
): DealerRow[] {
  const working = buildDistributionWorkingDealerRows(profile, options);
  return distributionEntryScopedDealerRows(working, profile);
}
