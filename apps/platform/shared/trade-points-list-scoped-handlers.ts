/**
 * Промт 393 — плоский список торговых точек из БД с учётом scope пользователя.
 */

import type { UserRole } from "./auth.js";
import {
  computeDbScopeForUser,
  DEALER_OVERRIDE_JOIN,
  TRADE_POINT_OVERRIDE_JOIN,
  type DbScopeResult,
} from "./db-scope-formula.js";
import { dealerJoinStatusActive, tpJoinStatusActive } from "./record-status.js";
import type { PoolLike } from "./responsibility-resolver.js";
import {
  canViewerAccessUserScope,
  fetchScopeTargetUser,
  type ScopeTargetUser,
} from "./scope-for-user-access.js";

export type ScopedTradePointDto = {
  id: string;
  externalKey: string;
  name: string;
  city: string | null;
  address: string | null;
  format: string | null;
  isActive: boolean;
  isPrimary: boolean;
  importanceTier: string | null;
  dealerId: string;
  dealerExternalKey: string;
  dealerName: string;
  dealerReleaseCode: string | null;
  dealerCity: string | null;
  dealerClientCategory: string | null;
  managerUserId: string | null;
  managerFullName: string | null;
  regionalManagerUserId: string | null;
  regionalManagerFullName: string | null;
  teamId: string | null;
  teamName: string | null;
  ropUserId: string | null;
  ropFullName: string | null;
  /** dealer_overrides.rop_id — территориальный РОП клиента (может отличаться от ca.team_id). */
  overrideRopUserId: string | null;
};

type ScopedTradePointSqlRow = {
  id: string;
  external_key: string;
  name: string;
  city: string | null;
  address: string | null;
  format: string | null;
  is_active: boolean;
  is_primary: boolean;
  importance_tier: string | null;
  dealer_id: string;
  dealer_external_key: string;
  dealer_name: string;
  dealer_release_code: string | null;
  dealer_city: string | null;
  dealer_client_category: string | null;
  manager_user_id: string | null;
  manager_full_name: string | null;
  regional_manager_user_id: string | null;
  regional_manager_full_name: string | null;
  team_id: string | null;
  team_name: string | null;
  rop_user_id: string | null;
  rop_full_name: string | null;
  override_rop_user_id: string | null;
};

export type ListScopedTradePointsResult =
  | {
      success: true;
      source: "db";
      tradePoints: ScopedTradePointDto[];
      meta: { total: number; scope: "self" | "team" | "org" };
    }
  | { forbidden: true }
  | { notFound: true };

export type TradePointsListScopedViewer = {
  id: string;
  role: UserRole;
};

const SCOPED_TP_SELECT = `
  tp.id::text,
  tp.external_key,
  tp.name,
  tp.city,
  tp.address,
  tp.format,
  tp.is_active,
  tp.is_primary AS is_primary,
  tp.importance_tier,
  d.id::text AS dealer_id,
  d.external_key AS dealer_external_key,
  d.name AS dealer_name,
  d.release_code AS dealer_release_code,
  d.city AS dealer_city,
  d.client_category AS dealer_client_category,
  ca.responsible_user_id::text AS manager_user_id,
  mu.full_name AS manager_full_name,
  d_ov.regional_manager_id::text AS regional_manager_user_id,
  rmu.full_name AS regional_manager_full_name,
  ca.team_id::text AS team_id,
  t.name AS team_name,
  t.rop_user_id::text AS rop_user_id,
  ru.full_name AS rop_full_name,
  d_ov.rop_id::text AS override_rop_user_id
`;

export function mapScopedTradePointRow(row: ScopedTradePointSqlRow): ScopedTradePointDto {
  return {
    id: row.id,
    externalKey: row.external_key,
    name: row.name,
    city: row.city,
    address: row.address,
    format: row.format,
    isActive: row.is_active,
    isPrimary: row.is_primary,
    importanceTier: row.importance_tier,
    dealerId: row.dealer_id,
    dealerExternalKey: row.dealer_external_key,
    dealerName: row.dealer_name,
    dealerReleaseCode: row.dealer_release_code,
    dealerCity: row.dealer_city,
    dealerClientCategory: row.dealer_client_category,
    managerUserId: row.manager_user_id,
    managerFullName: row.manager_full_name,
    regionalManagerUserId: row.regional_manager_user_id,
    regionalManagerFullName: row.regional_manager_full_name,
    teamId: row.team_id,
    teamName: row.team_name,
    ropUserId: row.rop_user_id,
    ropFullName: row.rop_full_name,
    overrideRopUserId: row.override_rop_user_id,
  };
}

function scopeKindFromRole(role: UserRole, fullCatalog: boolean): "self" | "team" | "org" {
  if (fullCatalog) return "org";
  if (role === "manager" || role === "sales_manager") return "self";
  return "team";
}

async function resolveScopeSubject(
  pool: PoolLike,
  viewer: TradePointsListScopedViewer,
  forUserId?: string | null,
): Promise<
  | { forbidden: true }
  | { notFound: true }
  | { subject: ScopeTargetUser; scope: DbScopeResult }
> {
  const targetId = forUserId?.trim();
  if (!targetId || targetId === viewer.id) {
    const subject = await fetchScopeTargetUser(pool, viewer.id);
    if (!subject || subject.status !== "active") return { notFound: true };
    const scope = await computeDbScopeForUser(pool, subject.id, subject.role);
    return { subject, scope };
  }

  const allowed = await canViewerAccessUserScope(pool, viewer.id, viewer.role, targetId);
  if (!allowed) return { forbidden: true };

  const subject = await fetchScopeTargetUser(pool, targetId);
  if (!subject || subject.status !== "active") return { notFound: true };

  const scope = await computeDbScopeForUser(pool, subject.id, subject.role);
  return { subject, scope };
}

export async function fetchScopedTradePointsRows(
  pool: PoolLike,
  scope: DbScopeResult,
  options?: { activeOnly?: boolean },
): Promise<ScopedTradePointSqlRow[]> {
  const activeOnly = options?.activeOnly !== false;
  const baseWhere = `
    ${dealerJoinStatusActive("d_ov")}
    AND ${tpJoinStatusActive("tpo")}
    ${activeOnly ? "AND tp.is_active = TRUE" : ""}
  `;

  if (scope.scope_explanation.full_catalog) {
    const r = await pool.query<ScopedTradePointSqlRow>(
      `SELECT ${SCOPED_TP_SELECT}
         FROM trade_points tp
         INNER JOIN dealers d ON d.id = tp.dealer_id
         LEFT JOIN client_assignments ca ON ca.client_code = d.release_code
         LEFT JOIN users mu ON mu.id = ca.responsible_user_id
         LEFT JOIN teams t ON t.id = ca.team_id
         LEFT JOIN users ru ON ru.id = t.rop_user_id
         ${DEALER_OVERRIDE_JOIN}
         LEFT JOIN users rmu ON rmu.id = d_ov.regional_manager_id
         ${TRADE_POINT_OVERRIDE_JOIN}
        WHERE ${baseWhere}
        ORDER BY d.name, tp.name`,
    );
    return r.rows;
  }

  if (scope.active_dealer_external_keys.length === 0) {
    return [];
  }

  const r = await pool.query<ScopedTradePointSqlRow>(
    `SELECT ${SCOPED_TP_SELECT}
       FROM trade_points tp
       INNER JOIN dealers d ON d.id = tp.dealer_id
       LEFT JOIN client_assignments ca ON ca.client_code = d.release_code
       LEFT JOIN users mu ON mu.id = ca.responsible_user_id
       LEFT JOIN teams t ON t.id = ca.team_id
       LEFT JOIN users ru ON ru.id = t.rop_user_id
       ${DEALER_OVERRIDE_JOIN}
       LEFT JOIN users rmu ON rmu.id = d_ov.regional_manager_id
       ${TRADE_POINT_OVERRIDE_JOIN}
      WHERE d.external_key = ANY($1::text[])
        AND ${baseWhere}
      ORDER BY d.name, tp.name`,
    [scope.active_dealer_external_keys],
  );
  return r.rows;
}

export async function handleTradePointsListScoped(
  pool: PoolLike,
  viewer: TradePointsListScopedViewer,
  forUserId?: string | null,
): Promise<ListScopedTradePointsResult> {
  const resolved = await resolveScopeSubject(pool, viewer, forUserId);
  if ("forbidden" in resolved) return { forbidden: true };
  if ("notFound" in resolved) return { notFound: true };

  const { subject, scope } = resolved;

  const rows = await fetchScopedTradePointsRows(pool, scope, { activeOnly: true });
  const tradePoints = rows.map(mapScopedTradePointRow);

  return {
    success: true,
    source: "db",
    tradePoints,
    meta: {
      total: tradePoints.length,
      scope: scopeKindFromRole(subject.role, scope.scope_explanation.full_catalog),
    },
  };
}
