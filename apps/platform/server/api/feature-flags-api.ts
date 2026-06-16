/**
 * Feature flags для клиента (Промт 376).
 */

import { shadowDiffEnabled, useDbDealers } from "../dealers/dealers-source-config.js";

export type FeatureFlagsResponse = {
  success: true;
  flags: {
    USE_DB_DEALERS: boolean;
    SHADOW_DIFF_ENABLED: boolean;
  };
};

export function getFeatureFlags(): FeatureFlagsResponse {
  return {
    success: true,
    flags: {
      USE_DB_DEALERS: useDbDealers(),
      SHADOW_DIFF_ENABLED: shadowDiffEnabled(),
    },
  };
}
