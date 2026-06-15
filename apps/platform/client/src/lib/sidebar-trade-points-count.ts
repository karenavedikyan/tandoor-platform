/**
 * Счётчик рабочих ТТ для бейджа навигации — совпадает с `summary.total` на /trade-points.
 */

import type { ActualizationState } from "@/lib/client-base-actualization-state";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import { countTradePointsWorkingRows } from "@/lib/trade-points-working-rows";

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
