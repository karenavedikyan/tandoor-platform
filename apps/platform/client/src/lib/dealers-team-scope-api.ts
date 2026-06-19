/**
 * GET /api/dealers/team-scope — клиент (Промт 423).
 */

import type { QueryClient } from "@tanstack/react-query";
import type { TeamScopePayload } from "@shared/dealers-scope-types";
import { queryClient } from "./queryClient";

export type { TeamScopePayload, TeamScopeMember, TeamTotals, MemberTotals } from "@shared/dealers-scope-types";

export const SCOPE_FORBIDDEN_ERROR = "SCOPE_FORBIDDEN";

export function teamScopeQueryKey(ropUserId?: string): readonly [string, string, string, ...string[]] {
  return ropUserId
    ? (["dealers", "scope", "team", ropUserId] as const)
    : (["dealers", "scope", "team", "self"] as const);
}

export async function fetchTeamScope(ropUserId?: string): Promise<TeamScopePayload> {
  const q = ropUserId ? `?ropUserId=${encodeURIComponent(ropUserId)}` : "";
  const res = await fetch(`/api/dealers/team-scope${q}`, { method: "GET", credentials: "same-origin" });
  if (res.status === 401) throw new Error("UNAUTHENTICATED");
  if (res.status === 403) throw new Error(SCOPE_FORBIDDEN_ERROR);
  const json = (await res.json()) as TeamScopePayload & { success: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `team-scope HTTP ${res.status}`);
  }
  return json;
}

export function invalidateTeamScope(qc: QueryClient = queryClient, ropUserId?: string): void {
  void qc.invalidateQueries({ queryKey: teamScopeQueryKey(ropUserId) });
  void qc.invalidateQueries({ queryKey: ["dealers", "scope", "team"] });
}

export function invalidateAllDealerScopes(qc: QueryClient = queryClient): void {
  void qc.invalidateQueries({ queryKey: ["dealers", "scope"] });
  void qc.invalidateQueries({ queryKey: ["dealers", "my-scope"] });
}
