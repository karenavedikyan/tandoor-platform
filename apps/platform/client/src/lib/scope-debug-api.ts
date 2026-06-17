/**
 * GET /api/admin/scope-debug — разложение scope для диагностики (Промт 383).
 */

import type { UserRole } from "@shared/auth";

export type ScopeDebugTeamRow = {
  id: string;
  name: string;
  rop_user_id: string | null;
  role_in_team: string | null;
};

export type ScopeDebugPayload = {
  success: true;
  user: { id: string; email: string; full_name: string; role: UserRole };
  teams: ScopeDebugTeamRow[];
  scope: {
    own_client_codes: string[];
    team_client_codes: string[];
    granted_client_codes: string[];
    visible_dealer_count: number;
    visible_trade_point_count: number;
    trashed_in_scope_count: number;
    catalog_dealer_count: number;
    visible_codes_count: number | null;
    assignments_active: boolean;
  };
  explanation: string[];
};

export async function fetchScopeDebug(params: { userId?: string; email?: string }): Promise<ScopeDebugPayload> {
  const qs = new URLSearchParams();
  if (params.userId) qs.set("user_id", params.userId);
  if (params.email) qs.set("email", params.email);
  const res = await fetch(`/api/admin/scope-debug?${qs.toString()}`, { credentials: "include" });
  const json = (await res.json()) as ScopeDebugPayload & { success: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `scope-debug HTTP ${res.status}`);
  }
  return json;
}
