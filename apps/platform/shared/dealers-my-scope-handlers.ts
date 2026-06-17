/**
 * GET /api/dealers/my-scope — scope и счётчики из БД (Промт 384).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import { computeDbScopeForUser, type DbScopeResult } from "./db-scope-formula.js";

export type MyDealerScopeUser = {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
};

export type MyDealerScopePayload = {
  success: true;
  user: { id: string; email: string; role: UserRole; full_name?: string };
  totals: DbScopeResult["totals"];
  active_dealer_ids: string[];
  active_dealer_external_keys: string[];
  trashed_dealer_ids: string[];
  trashed_dealer_external_keys: string[];
  scope_explanation: DbScopeResult["scope_explanation"];
};

export async function fetchMyDealerScope(
  pool: PoolLike,
  user: MyDealerScopeUser,
): Promise<MyDealerScopePayload> {
  const role = user.role;
  const scope = await computeDbScopeForUser(pool, user.id, role);

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role,
      full_name: user.full_name,
    },
    totals: scope.totals,
    active_dealer_ids: scope.active_dealer_ids,
    active_dealer_external_keys: scope.active_dealer_external_keys,
    trashed_dealer_ids: scope.trashed_dealer_ids,
    trashed_dealer_external_keys: scope.trashed_dealer_external_keys,
    scope_explanation: scope.scope_explanation,
  };
}
