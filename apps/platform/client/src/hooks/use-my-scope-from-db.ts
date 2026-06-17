/**
 * Единый scope из БД (Промт 384, 388).
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchMyDealerScope,
  myDealerScopeQueryKey,
  SCOPE_FORBIDDEN_ERROR,
  type MyDealerScopePayload,
} from "@/lib/dealers-my-scope-api";

export type MyScopeFromDB = MyDealerScopePayload & {
  loading: boolean;
  ready: boolean;
  error: boolean;
  forbidden: boolean;
  activeDealerIdSet: Set<string>;
  trashedDealerIdSet: Set<string>;
  activeDealerExternalKeySet: Set<string>;
  trashedDealerExternalKeySet: Set<string>;
  /** Чей scope отображается (для forUserId — viewed_user). */
  scopeSubject: MyDealerScopePayload["user"];
};

export type UseMyScopeFromDBOptions = {
  enabled?: boolean;
  /** UUID пользователя, чей scope запросить (Промт 388). */
  forUserId?: string;
};

const EMPTY_SCOPE: Omit<MyScopeFromDB, "loading" | "ready" | "error" | "forbidden" | "scopeSubject"> & {
  scopeSubject: MyDealerScopePayload["user"];
} = {
  success: true as const,
  user: { id: "", email: "", role: "manager" as const },
  scopeSubject: { id: "", email: "", role: "manager" as const },
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
  activeDealerIdSet: new Set(),
  trashedDealerIdSet: new Set(),
  activeDealerExternalKeySet: new Set(),
  trashedDealerExternalKeySet: new Set(),
};

export function useMyScopeFromDB(enabledOrOptions: boolean | UseMyScopeFromDBOptions = true): MyScopeFromDB {
  const opts: UseMyScopeFromDBOptions =
    typeof enabledOrOptions === "boolean" ? { enabled: enabledOrOptions } : enabledOrOptions;
  const enabled = opts.enabled ?? true;
  const forUserId = opts.forUserId?.trim() || undefined;

  const q = useQuery({
    queryKey: myDealerScopeQueryKey(forUserId),
    queryFn: () => fetchMyDealerScope(forUserId),
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
  const scopeSubject = data?.viewed_user ?? data?.user ?? EMPTY_SCOPE.scopeSubject;
  const forbidden = q.isError && q.error instanceof Error && q.error.message === SCOPE_FORBIDDEN_ERROR;

  return {
    ...(data ?? EMPTY_SCOPE),
    loading: q.isLoading,
    ready: Boolean(data && !q.isLoading && !q.isError),
    error: q.isError,
    forbidden,
    activeDealerIdSet,
    trashedDealerIdSet,
    activeDealerExternalKeySet,
    trashedDealerExternalKeySet,
    scopeSubject,
  };
}

/** Счётчики сайдбара из totals API (null пока грузится). Только для scope текущего юзера. */
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

export { myDealerScopeQueryKey as MY_DEALER_SCOPE_QUERY_KEY } from "@/lib/dealers-my-scope-api";
