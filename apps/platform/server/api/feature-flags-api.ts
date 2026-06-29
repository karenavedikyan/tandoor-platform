/**
 * Feature flags для клиента (Промт 376).
 */

import { shadowDiffEnabled, useDbDealers, useServerKpiAggregates } from "../dealers/dealers-source-config.js";

export type FeatureFlagsResponse = {
  success: true;
  flags: {
    USE_DB_DEALERS: boolean;
    SHADOW_DIFF_ENABLED: boolean;
    USE_SERVER_KPI_AGGREGATES: boolean;
  };
};

export function getFeatureFlags(): FeatureFlagsResponse {
  return {
    success: true,
    flags: {
      USE_DB_DEALERS: useDbDealers(),
      SHADOW_DIFF_ENABLED: shadowDiffEnabled(),
      USE_SERVER_KPI_AGGREGATES: useServerKpiAggregates(),
    },
  };
}
