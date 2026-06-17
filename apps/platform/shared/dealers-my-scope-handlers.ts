/**
 * GET /api/dealers/my-scope — scope и счётчики из БД (Промт 384).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import { computeDbScopeForUser, type DbScopeResult } from "./db-scope-formula.js";
import {
  canViewerAccessUserScope,
  fetchScopeTargetUser,
  type ScopeTargetUser,
} from "./scope-for-user-access.js";

export type MyDealerScopeUser = {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
};

export type MyDealerScopePayload = {
  success: true;
  user: { id: string; email: string; role: UserRole; full_name?: string };
  viewed_user?: { id: string; email: string; role: UserRole; full_name?: string };
  totals: DbScopeResult["totals"];
  active_dealer_ids: string[];
  active_dealer_external_keys: string[];
  trashed_dealer_ids: string[];
  trashed_dealer_external_keys: string[];
  scope_explanation: DbScopeResult["scope_explanation"];
};

function toScopeUser(u: ScopeTargetUser | MyDealerScopeUser): {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
} {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    full_name: u.full_name ?? undefined,
  };
}

function buildPayload(
  scopeUser: ScopeTargetUser | MyDealerScopeUser,
  scope: DbScopeResult,
  viewedUser?: ScopeTargetUser | MyDealerScopeUser,
): MyDealerScopePayload {
  return {
    success: true,
    user: toScopeUser(scopeUser),
    ...(viewedUser ? { viewed_user: toScopeUser(viewedUser) } : {}),
    totals: scope.totals,
    active_dealer_ids: scope.active_dealer_ids,
    active_dealer_external_keys: scope.active_dealer_external_keys,
    trashed_dealer_ids: scope.trashed_dealer_ids,
    trashed_dealer_external_keys: scope.trashed_dealer_external_keys,
    scope_explanation: scope.scope_explanation,
  };
}

export async function fetchMyDealerScope(
  pool: PoolLike,
  user: MyDealerScopeUser,
): Promise<MyDealerScopePayload> {
  const scope = await computeDbScopeForUser(pool, user.id, user.role);
  return buildPayload(user, scope);
}

export async function fetchMyDealerScopeForRequest(
  pool: PoolLike,
  viewer: MyDealerScopeUser,
  forUserId?: string | null,
): Promise<MyDealerScopePayload | { forbidden: true } | { notFound: true }> {
  const targetId = forUserId?.trim();
  if (!targetId || targetId === viewer.id) {
    return fetchMyDealerScope(pool, viewer);
  }

  const allowed = await canViewerAccessUserScope(pool, viewer.id, viewer.role, targetId);
  if (!allowed) return { forbidden: true };

  const target = await fetchScopeTargetUser(pool, targetId);
  if (!target || target.status !== "active") return { notFound: true };

  const scope = await computeDbScopeForUser(pool, target.id, target.role);
  return buildPayload(viewer, scope, target);
}
