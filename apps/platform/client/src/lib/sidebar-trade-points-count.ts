/**
 * Счётчик рабочих ТТ для бейджа навигации — совпадает с `summary.total` на /trade-points.
 */

import type { ActualizationState } from "./client-base-actualization-state.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import type { SidebarNavRealScope } from "./sidebar-nav-real-scope.js";
import { countTradePointsWorkingRows } from "./trade-points-working-rows.js";

export type SidebarTradePointsCountContext = {
  enabled: boolean;
  loading: boolean;
  state: ActualizationState;
  managementDisplayState?: ActualizationState;
  managementTeamFetchLoading?: boolean;
  realScope?: SidebarNavRealScope;
};

export function resolveSidebarTradePointsCount(
  profile: ReleaseDemoProfile,
  ctx: SidebarTradePointsCountContext,
): number | null {
  if (ctx.enabled && ctx.loading) return null;
  if (ctx.enabled && ctx.managementTeamFetchLoading) return null;

  const actState = ctx.managementDisplayState ?? ctx.state;

  return countTradePointsWorkingRows({
    profile,
    actEnabled: ctx.enabled,
    actState,
    realScope: ctx.realScope,
  });
}
