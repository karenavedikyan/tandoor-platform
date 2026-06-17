/**
 * GET /api/dealers/my-scope — клиент (Промт 384).
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

export type MyDealerScopePayload = {
  success: true;
  user: { id: string; email: string; role: UserRole; full_name?: string };
  totals: MyDealerScopeTotals;
  active_dealer_ids: string[];
  active_dealer_external_keys: string[];
  trashed_dealer_ids: string[];
  trashed_dealer_external_keys: string[];
  scope_explanation: MyDealerScopeExplanation;
};

export const MY_DEALER_SCOPE_QUERY_KEY = ["dealers", "my-scope"] as const;

export async function fetchMyDealerScope(): Promise<MyDealerScopePayload> {
  const res = await fetch("/api/dealers/my-scope", { method: "GET", credentials: "same-origin" });
  if (res.status === 401) {
    throw new Error("UNAUTHENTICATED");
  }
  const json = (await res.json()) as MyDealerScopePayload & { success: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `my-scope HTTP ${res.status}`);
  }
  return json;
}

export function invalidateMyDealerScope(qc: QueryClient = queryClient): void {
  void qc.invalidateQueries({ queryKey: MY_DEALER_SCOPE_QUERY_KEY });
}
