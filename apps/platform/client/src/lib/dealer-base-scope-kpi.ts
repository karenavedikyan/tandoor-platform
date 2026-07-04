/**
 * KPI-карточки dealer-base overview: единые источники scope totals и дистрибуции.
 */

import { formatDistributionPercent, type DistributionGroupMetrics } from "./distribution-analytics/distribution-analytics-math.js";
import { sidebarCountsFromDbScope, type MyScopeFromDB } from "@/hooks/use-my-scope-from-db";
import { sidebarCountsFromTeamScope, type MyTeamScopeFromDB } from "@/hooks/use-my-team-scope";
import { sidebarCountsFromOrgScope, type OrgScopeFromDB } from "@/hooks/use-org-scope";
import type { UserRole } from "@shared/auth.js";

export function resolveScopeTradePointsCount(args: {
  useReal: boolean;
  viewingOtherUserScope: boolean;
  role: UserRole | undefined;
  targetScopeQ: MyScopeFromDB;
  orgScopeQ: OrgScopeFromDB;
  teamScopeTotalsQ: MyTeamScopeFromDB;
  selfDbScopeQ: MyScopeFromDB;
}): number | null {
  if (!args.useReal) return null;
  if (args.viewingOtherUserScope) {
    return sidebarCountsFromDbScope(args.targetScopeQ).tradePoints;
  }
  if (args.role === "director") {
    return sidebarCountsFromOrgScope(args.orgScopeQ).tradePoints;
  }
  if (args.role === "rop") {
    return sidebarCountsFromTeamScope(args.teamScopeTotalsQ).tradePoints;
  }
  if (args.role === "admin" || args.role === "manager" || args.role === "regional_manager") {
    return sidebarCountsFromDbScope(args.selfDbScopeQ).tradePoints;
  }
  return null;
}

export function resolveKpiTradePointsDisplay(args: {
  scopeTradePointsCount: number | null;
  kpisReady: boolean;
  overviewTradePointsLoading: boolean;
  overviewTradePointsCount: number | null;
  placeholder: string;
}): string {
  if (args.scopeTradePointsCount != null) {
    return args.kpisReady ? String(args.scopeTradePointsCount) : args.placeholder;
  }
  if (args.overviewTradePointsLoading) return args.placeholder;
  return args.overviewTradePointsCount != null ? String(args.overviewTradePointsCount) : "—";
}

export function isScopeDistributionKpiLoading(args: {
  useReal: boolean;
  kpisReady: boolean;
  scopeDistributionLoading: boolean;
  scopeTradePointIdsReady: boolean;
  scopeDistributionTradePointsCount: number;
}): boolean {
  if (!args.useReal) return false;
  return (
    !args.kpisReady ||
    args.scopeDistributionLoading ||
    (!args.scopeTradePointIdsReady && args.scopeDistributionTradePointsCount === 0)
  );
}

export function resolveKpiAverageDistributionDisplay(args: {
  useReal: boolean;
  kpisReady: boolean;
  scopeDistributionLoading: boolean;
  scopeTradePointIdsReady: boolean;
  scopeDistributionTradePointsCount: number;
  aggregate: DistributionGroupMetrics;
  fallbackAvgDist: number;
  placeholder: string;
}): string {
  if (isScopeDistributionKpiLoading(args)) {
    return args.placeholder;
  }
  if (args.useReal) {
    return formatDistributionPercent(args.aggregate.averagePercent);
  }
  return args.kpisReady ? `${args.fallbackAvgDist}%` : args.placeholder;
}
