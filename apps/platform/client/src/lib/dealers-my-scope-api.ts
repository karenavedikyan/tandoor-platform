/**
 * GET /api/dealers/my-scope — клиент (Промт 384, 388).
 */

import type { QueryClient } from "@tanstack/react-query";
import type { UserRole } from "@shared/auth";
import { queryClient } from "./queryClient";

export type MyDealerScopeTotals = {
  active_dealers: number;
  active_trade_points: number;
  trashed_dealers: number;
  trashed_trade_points: number;
  admin_purge_queue_dealers?: number;
  admin_purge_queue_trade_points?: number;
};

export type MyDealerScopeExplanation = {
  role: string;
  team_ids: string[];
  own_codes: number;
  team_codes: number;
  granted_codes: number;
  all_codes: number;
  full_catalog: boolean;
};

export type MyDealerScopeTradePoint = {
  tp_id: string;
  dealer_id: string;
  is_primary: boolean;
};

export type MyDealerScopePayload = {
  success: true;
  user: { id: string; email: string; role: UserRole; full_name?: string };
  viewed_user?: { id: string; email: string; role: UserRole; full_name?: string };
  totals: MyDealerScopeTotals;
  active_dealer_ids: string[];
  active_dealer_external_keys: string[];
  trashed_dealer_ids: string[];
  trashed_dealer_external_keys: string[];
  active_trade_points: MyDealerScopeTradePoint[];
  scope_explanation: MyDealerScopeExplanation;
};

export const SCOPE_FORBIDDEN_ERROR = "SCOPE_FORBIDDEN";

export function myDealerScopeQueryKey(forUserId?: string): readonly [string, string, ...string[]] {
  return forUserId ? (["dealers", "my-scope", forUserId] as const) : (["dealers", "my-scope", "self"] as const);
}

/** @deprecated use myDealerScopeQueryKey() */
export const MY_DEALER_SCOPE_QUERY_KEY = myDealerScopeQueryKey();

export async function fetchMyDealerScope(forUserId?: string): Promise<MyDealerScopePayload> {
  const q = forUserId ? `?for_user_id=${encodeURIComponent(forUserId)}` : "";
  const res = await fetch(`/api/dealers/my-scope${q}`, { method: "GET", credentials: "same-origin" });
  if (res.status === 401) {
    throw new Error("UNAUTHENTICATED");
  }
  if (res.status === 403) {
    throw new Error(SCOPE_FORBIDDEN_ERROR);
  }
  const json = (await res.json()) as MyDealerScopePayload & { success: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `my-scope HTTP ${res.status}`);
  }
  return json;
}

export function invalidateMyDealerScope(qc: QueryClient = queryClient, forUserId?: string): void {
  void qc.invalidateQueries({ queryKey: myDealerScopeQueryKey(forUserId) });
}
