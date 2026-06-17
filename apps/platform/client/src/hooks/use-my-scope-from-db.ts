/**
 * Единый scope из БД (Промт 384).
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchMyDealerScope,
  MY_DEALER_SCOPE_QUERY_KEY,
  type MyDealerScopePayload,
} from "@/lib/dealers-my-scope-api";

export type MyScopeFromDB = MyDealerScopePayload & {
  loading: boolean;
  ready: boolean;
  error: boolean;
  activeDealerIdSet: Set<string>;
  trashedDealerIdSet: Set<string>;
  activeDealerExternalKeySet: Set<string>;
  trashedDealerExternalKeySet: Set<string>;
};

export function useMyScopeFromDB(enabled = true): MyScopeFromDB {
  const q = useQuery({
    queryKey: MY_DEALER_SCOPE_QUERY_KEY,
    queryFn: fetchMyDealerScope,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });

  const data = q.data;
  const activeDealerIdSet = new Set(data?.active_dealer_ids ?? []);
  const trashedDealerIdSet = new Set(data?.trashed_dealer_ids ?? []);
  const activeDealerExternalKeySet = new Set(data?.active_dealer_external_keys ?? []);
  const trashedDealerExternalKeySet = new Set(data?.trashed_dealer_external_keys ?? []);

  return {
    ...(data ?? {
      success: true as const,
      user: { id: "", email: "", role: "manager" as const },
      totals: {
        active_dealers: 0,
        active_trade_points: 0,
        trashed_dealers: 0,
        trashed_trade_points: 0,
      },
      active_dealer_ids: [],
      active_dealer_external_keys: [],
      trashed_dealer_ids: [],
      trashed_dealer_external_keys: [],
      scope_explanation: {
        role: "",
        team_ids: [],
        own_codes: 0,
        team_codes: 0,
        granted_codes: 0,
        all_codes: 0,
        full_catalog: false,
      },
    }),
    loading: q.isLoading,
    ready: Boolean(data && !q.isLoading && !q.isError),
    error: q.isError,
    activeDealerIdSet,
    trashedDealerIdSet,
    activeDealerExternalKeySet,
    trashedDealerExternalKeySet,
  };
}

/** Счётчики сайдбара из totals API (null пока грузится). */
export function sidebarCountsFromDbScope(scope: MyScopeFromDB): {
  dealers: number | null;
  tradePoints: number | null;
  trash: number | null;
  adminPurgeQueue: number | null;
} {
  if (!scope.ready) {
    return { dealers: null, tradePoints: null, trash: null, adminPurgeQueue: null };
  }
  return {
    dealers: scope.totals.active_dealers,
    tradePoints: scope.totals.active_trade_points,
    trash: scope.totals.trashed_dealers,
    adminPurgeQueue: scope.totals.admin_purge_queue_dealers ?? 0,
  };
}
