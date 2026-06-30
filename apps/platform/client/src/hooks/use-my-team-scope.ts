/**
 * Scope команды РОП из БД (Промт 423).
 */

import { useQuery } from "@tanstack/react-query";
import type { KpiCountsFromScope } from "@/hooks/use-my-scope-from-db";
import {
  fetchTeamScope,
  fetchTeamScopeTotals,
  teamScopeQueryKey,
  teamScopeTotalsQueryKey,
  SCOPE_FORBIDDEN_ERROR,
  type TeamScopePayload,
} from "@/lib/dealers-team-scope-api";

export type UseMyTeamScopeOptions = {
  ropUserId?: string;
  enabled?: boolean;
};

export type MyTeamScopeFromDB = {
  ready: boolean;
  data: TeamScopePayload | null;
  isLoading: boolean;
  isError: boolean;
  forbidden: boolean;
};

export function useMyTeamScope(options?: UseMyTeamScopeOptions): MyTeamScopeFromDB {
  const enabled = options?.enabled ?? true;
  const ropUserId = options?.ropUserId?.trim() || undefined;

  const q = useQuery({
    queryKey: teamScopeQueryKey(ropUserId),
    queryFn: () => fetchTeamScope(ropUserId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });

  const forbidden = q.isError && q.error instanceof Error && q.error.message === SCOPE_FORBIDDEN_ERROR;

  return {
    ready: Boolean(q.data && !q.isLoading && !q.isError),
    data: q.data ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    forbidden,
  };
}

export function useMyTeamScopeTotals(options?: UseMyTeamScopeOptions): MyTeamScopeFromDB {
  const enabled = options?.enabled ?? true;
  const ropUserId = options?.ropUserId?.trim() || undefined;

  const q = useQuery({
    queryKey: teamScopeTotalsQueryKey(ropUserId),
    queryFn: () => fetchTeamScopeTotals(ropUserId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });

  const forbidden = q.isError && q.error instanceof Error && q.error.message === SCOPE_FORBIDDEN_ERROR;

  return {
    ready: Boolean(q.data && !q.isLoading && !q.isError),
    data: q.data ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    forbidden,
  };
}

export function kpiCountsFromTeamScope(scope: MyTeamScopeFromDB): KpiCountsFromScope | null {
  if (!scope.ready || !scope.data) return null;
  const t = scope.data.team_totals;
  return {
    total: t.active_dealers,
    active: t.tp_status_active,
    potential: t.tp_status_potential,
    attention: t.tp_status_attention,
    avgDist: t.avg_distribution,
  };
}

export function sidebarCountsFromTeamScope(scope: MyTeamScopeFromDB): {
  dealers: number | null;
  tradePoints: number | null;
  trashDealers: number | null;
  trashTradePoints: number | null;
} {
  if (!scope.ready || !scope.data) {
    return { dealers: null, tradePoints: null, trashDealers: null, trashTradePoints: null };
  }
  const t = scope.data.team_totals;
  return {
    dealers: t.active_dealers,
    tradePoints: t.active_trade_points,
    trashDealers: t.trashed_dealers,
    trashTradePoints: t.trashed_trade_points,
  };
}
