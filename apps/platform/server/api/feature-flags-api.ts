/**
 * Feature flags для клиента (Промт 376).
 */

import {
  shadowDiffEnabled,
  useDbDealers,
  useDistributionDbPrimary,
  useServerKpiAggregates,
  useTpHydrationNoWriteback,
} from "../dealers/dealers-source-config.js";

export type FeatureFlagsResponse = {
  success: true;
  flags: {
    USE_DB_DEALERS: boolean;
    SHADOW_DIFF_ENABLED: boolean;
    USE_SERVER_KPI_AGGREGATES: boolean;
    TP_HYDRATION_NO_WRITEBACK: boolean;
    DISTRIBUTION_DB_PRIMARY_CAPACITY: boolean;
  };
};

export function getFeatureFlags(): FeatureFlagsResponse {
  return {
    success: true,
    flags: {
      USE_DB_DEALERS: useDbDealers(),
      SHADOW_DIFF_ENABLED: shadowDiffEnabled(),
      USE_SERVER_KPI_AGGREGATES: useServerKpiAggregates(),
      TP_HYDRATION_NO_WRITEBACK: useTpHydrationNoWriteback(),
      DISTRIBUTION_DB_PRIMARY_CAPACITY: useDistributionDbPrimary(),
    },
  };
}
