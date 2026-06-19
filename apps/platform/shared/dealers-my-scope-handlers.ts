/**
 * GET /api/dealers/my-scope — scope и счётчики из БД (Промт 384, 388).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import { computeDbScopeForUser, type DbScopeResult } from "./db-scope-formula.js";
import { tpJoinStatusActive } from "./record-status.js";
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

export type MyDealerScopeTradePoint = {
  tp_id: string;
  dealer_id: string;
  is_primary: boolean;
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
  active_trade_points: MyDealerScopeTradePoint[];
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
  activeTradePoints: MyDealerScopeTradePoint[],
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
    active_trade_points: activeTradePoints,
    scope_explanation: scope.scope_explanation,
  };
}

async function fetchActiveTradePointsForScope(
  pool: PoolLike,
  scope: DbScopeResult,
): Promise<MyDealerScopeTradePoint[]> {
  if (scope.scope_explanation.full_catalog) {
    const r = await pool.query<MyDealerScopeTradePoint>(
      `SELECT COALESCE(tpo.tp_id, tp.external_key, tp.id::text) AS tp_id,
              d.external_key AS dealer_id,
              COALESCE(tpo.is_primary, FALSE) AS is_primary
         FROM trade_points tp
         INNER JOIN dealers d ON d.id = tp.dealer_id
         LEFT JOIN trade_point_overrides tpo ON (
           tpo.tp_id = tp.id::text OR tpo.tp_id = tp.external_key
         )
        WHERE tp.is_active = TRUE
          AND ${tpJoinStatusActive("tpo")}
        ORDER BY d.external_key, tp.external_key`,
    );
    return r.rows;
  }
  if (scope.active_dealer_external_keys.length === 0) return [];
  const r = await pool.query<MyDealerScopeTradePoint>(
    `SELECT COALESCE(tpo.tp_id, tp.external_key, tp.id::text) AS tp_id,
            d.external_key AS dealer_id,
            COALESCE(tpo.is_primary, FALSE) AS is_primary
       FROM trade_points tp
       INNER JOIN dealers d ON d.id = tp.dealer_id
       LEFT JOIN trade_point_overrides tpo ON (
         tpo.tp_id = tp.id::text OR tpo.tp_id = tp.external_key
       )
      WHERE d.external_key = ANY($1::text[])
        AND tp.is_active = TRUE
        AND ${tpJoinStatusActive("tpo")}
      ORDER BY d.external_key, tp.external_key`,
    [scope.active_dealer_external_keys],
  );
  return r.rows;
}

export async function fetchMyDealerScope(
  pool: PoolLike,
  user: MyDealerScopeUser,
): Promise<MyDealerScopePayload> {
  const scope = await computeDbScopeForUser(pool, user.id, user.role);
  const activeTradePoints = await fetchActiveTradePointsForScope(pool, scope);
  return buildPayload(user, scope, activeTradePoints);
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
  const activeTradePoints = await fetchActiveTradePointsForScope(pool, scope);
  return buildPayload(viewer, scope, activeTradePoints, target);
}
