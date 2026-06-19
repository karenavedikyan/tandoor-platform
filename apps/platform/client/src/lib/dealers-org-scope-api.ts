/**
 * GET /api/dealers/org-scope — клиент (Промт 423).
 */

import type { QueryClient } from "@tanstack/react-query";
import type { OrgScopePayload } from "@shared/dealers-scope-types";
import { queryClient } from "./queryClient";

export type { OrgScopePayload } from "@shared/dealers-scope-types";

export const ORG_SCOPE_FORBIDDEN_ERROR = "ORG_SCOPE_FORBIDDEN";

export function orgScopeQueryKey(): readonly [string, string, string] {
  return ["dealers", "scope", "org"] as const;
}

export async function fetchOrgScope(): Promise<OrgScopePayload> {
  const res = await fetch("/api/dealers/org-scope", { method: "GET", credentials: "same-origin" });
  if (res.status === 401) throw new Error("UNAUTHENTICATED");
  if (res.status === 403) throw new Error(ORG_SCOPE_FORBIDDEN_ERROR);
  const json = (await res.json()) as OrgScopePayload & { success: boolean; message?: string };
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? `org-scope HTTP ${res.status}`);
  }
  return json;
}

export function invalidateOrgScope(qc: QueryClient = queryClient): void {
  void qc.invalidateQueries({ queryKey: orgScopeQueryKey() });
}
