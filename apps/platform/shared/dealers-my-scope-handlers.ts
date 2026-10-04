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
import {
  intersectExternalKeyLists,
  intersectTargetDealerScopeWithViewerZone,
} from "./dealer-scope-rop-intersection.js";
import { resolveEmployeePreviewReadScope } from "./employee-preview-read-scope.js";

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

export async function fetchActiveTradePointsForScope(
  pool: PoolLike,
  scope: DbScopeResult,
  allowedStoreGuids?: Set<string> | null,
): Promise<MyDealerScopeTradePoint[]> {
  let rows: MyDealerScopeTradePoint[];
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
    rows = r.rows;
  } else if (scope.active_dealer_external_keys.length === 0) {
    return [];
  } else {
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
    rows = r.rows;
  }

  if (!allowedStoreGuids) return rows;
  return rows.filter(
    (row) =>
      allowedStoreGuids.has(row.tp_id) ||
      allowedStoreGuids.has(row.tp_id.toLowerCase()),
  );
}

function emptyPreviewScope(): DbScopeResult {
  return {
    totals: {
      active_dealers: 0,
      active_trade_points: 0,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 0,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
    },
    active_dealer_ids: [],
    active_dealer_external_keys: [],
    trashed_dealer_ids: [],
    trashed_dealer_external_keys: [],
    scope_explanation: {
      role: "employee_preview",
      team_ids: [],
      own_codes: 0,
      team_codes: 0,
      granted_codes: 0,
      all_codes: 0,
      full_catalog: false,
    },
  };
}

export async function fetchMyDealerScope(
  pool: PoolLike,
  user: MyDealerScopeUser,
  refreshTokenHash?: string | null,
): Promise<MyDealerScopePayload> {
  if (user.role === "admin" && refreshTokenHash) {
    const previewRead = await resolveEmployeePreviewReadScope(pool, refreshTokenHash);
    if (previewRead.mode === "active") {
      if (!previewRead.readable || !previewRead.scope) {
        return buildPayload(user, emptyPreviewScope(), []);
      }
      const keys = previewRead.scope.activeDealerExternalKeys;
      const allowedStores = new Set(previewRead.scope.activeStoreGuids);
      const scope: DbScopeResult = {
        totals: {
          active_dealers: keys.length,
          active_trade_points: allowedStores.size,
          trashed_dealers: 0,
          trashed_trade_points: 0,
          tp_status_active: 0,
          tp_status_potential: 0,
          tp_status_attention: 0,
          dealer_no_status: 0,
          avg_distribution: 0,
        },
        active_dealer_ids: [],
        active_dealer_external_keys: keys,
        trashed_dealer_ids: [],
        trashed_dealer_external_keys: [],
        scope_explanation: {
          role: "employee_preview",
          team_ids: [],
          own_codes: keys.length,
          team_codes: 0,
          granted_codes: 0,
          all_codes: keys.length,
          full_catalog: false,
        },
      };
      const activeTradePoints = await fetchActiveTradePointsForScope(pool, scope, allowedStores);
      scope.totals.active_trade_points = activeTradePoints.length;
      return buildPayload(user, scope, activeTradePoints);
    }
  }

  const scope = await computeDbScopeForUser(pool, user.id, user.role);
  const activeTradePoints = await fetchActiveTradePointsForScope(pool, scope);
  return buildPayload(user, scope, activeTradePoints);
}

export async function fetchMyDealerScopeForRequest(
  pool: PoolLike,
  viewer: MyDealerScopeUser,
  forUserId?: string | null,
  refreshTokenHash?: string | null,
): Promise<MyDealerScopePayload | { forbidden: true } | { notFound: true }> {
  const targetId = forUserId?.trim();
  if (!targetId || targetId === viewer.id) {
    return fetchMyDealerScope(pool, viewer, refreshTokenHash);
  }

  const target = await fetchScopeTargetUser(pool, targetId);
  if (!target || target.status !== "active") return { notFound: true };

  let allowed = await canViewerAccessUserScope(pool, viewer.id, viewer.role, targetId);
  const targetScope = await computeDbScopeForUser(pool, target.id, target.role);
  let effectiveScope = targetScope;

  if (viewer.role === "rop" && viewer.id !== target.id && !allowed) {
    try {
      const viewerScope = await computeDbScopeForUser(pool, viewer.id, "rop");
      const interKeys = intersectExternalKeyLists(
        targetScope.active_dealer_external_keys,
        viewerScope.active_dealer_external_keys,
      );
      if (interKeys.length > 0) {
        allowed = true;
        effectiveScope = intersectTargetDealerScopeWithViewerZone(targetScope, viewerScope.active_dealer_external_keys);
      }
    } catch (err) {
      console.warn("[dealers/my-scope] rop viewer scope intersection failed", {
        viewerId: viewer.id,
        targetId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!allowed) return { forbidden: true };

  const activeTradePoints = await fetchActiveTradePointsForScope(pool, effectiveScope);
  if (effectiveScope !== targetScope) {
    effectiveScope = {
      ...effectiveScope,
      totals: {
        ...effectiveScope.totals,
        active_dealers: effectiveScope.active_dealer_external_keys.length,
        active_trade_points: activeTradePoints.length,
      },
    };
  }

  return buildPayload(viewer, effectiveScope, activeTradePoints, target);
}
