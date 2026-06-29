/**
 * Scope всей орг-структуры из БД (Промт 423).
 */

import { useQuery } from "@tanstack/react-query";
import type { KpiCountsFromScope } from "@/hooks/use-my-scope-from-db";
import {
  fetchOrgScope,
  orgScopeQueryKey,
  ORG_SCOPE_FORBIDDEN_ERROR,
  type OrgScopePayload,
} from "@/lib/dealers-org-scope-api";

export type UseOrgScopeOptions = {
  enabled?: boolean;
};

export type OrgScopeFromDB = {
  ready: boolean;
  data: OrgScopePayload | null;
  isLoading: boolean;
  isError: boolean;
  forbidden: boolean;
};

export function useOrgScope(options?: UseOrgScopeOptions): OrgScopeFromDB {
  const enabled = options?.enabled ?? true;

  const q = useQuery({
    queryKey: orgScopeQueryKey(),
    queryFn: fetchOrgScope,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });

  const forbidden = q.isError && q.error instanceof Error && q.error.message === ORG_SCOPE_FORBIDDEN_ERROR;

  return {
    ready: Boolean(q.data && !q.isLoading && !q.isError),
    data: q.data ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    forbidden,
  };
}

export function kpiCountsFromOrgScope(scope: OrgScopeFromDB): KpiCountsFromScope | null {
  if (!scope.ready || !scope.data) return null;
  const t = scope.data.org_totals;
  return {
    total: t.active_dealers,
    active: t.tp_status_active,
    potential: t.tp_status_potential,
    attention: t.tp_status_attention,
    avgDist: t.avg_distribution,
  };
}

export function sidebarCountsFromOrgScope(scope: OrgScopeFromDB): {
  dealers: number | null;
  tradePoints: number | null;
  trashDealers: number | null;
  trashTradePoints: number | null;
} {
  if (!scope.ready || !scope.data) {
    return { dealers: null, tradePoints: null, trashDealers: null, trashTradePoints: null };
  }
  const t = scope.data.org_totals;
  return {
    dealers: t.active_dealers,
    tradePoints: t.active_trade_points,
    trashDealers: t.trashed_dealers,
    trashTradePoints: t.trashed_trade_points,
  };
}
