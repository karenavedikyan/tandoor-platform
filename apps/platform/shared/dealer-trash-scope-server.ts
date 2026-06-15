/**
 * Серверный гард scope для trash/untrash (Промт 337).
 * Семантика симметрична клиентскому `dealer-trash-scope.ts` (Промт 336).
 */

import type { PoolLike } from "./admin/admin-auth.js";

export type TrashScopeRole =
  | "admin"
  | "director"
  | "category_manager"
  | "rop"
  | "regional_manager"
  | "manager"
  | "sales_manager"
  | "marketer"
  | "analyst";

const FULL_VIEW: ReadonlySet<TrashScopeRole> = new Set(["admin", "director", "category_manager"]);
const NO_ACCESS: ReadonlySet<TrashScopeRole> = new Set(["marketer", "analyst"]);

export type DealerScopeCheck = { allowed: boolean; reason?: string };

function normalizeRole(role: string): TrashScopeRole | "unknown" {
  const r = role.trim() as TrashScopeRole;
  if (
    r === "admin" ||
    r === "director" ||
    r === "category_manager" ||
    r === "rop" ||
    r === "regional_manager" ||
    r === "manager" ||
    r === "sales_manager" ||
    r === "marketer" ||
    r === "analyst"
  ) {
    return r;
  }
  return "unknown";
}

async function countRows(pool: PoolLike, sql: string, params: unknown[]): Promise<number> {
  const r = await pool.query<{ c: string }>(sql, params);
  return Number(r.rows[0]?.c ?? 0);
}

/** Сопоставление dealer_id с client_code в client_assignments / rop_client_grants. */
function sqlClientCodeMatchesDealerId(paramIndex: number): string {
  return `(
    client_code = $${paramIndex}
    OR upper(client_code) = upper($${paramIndex})
    OR upper(regexp_replace(client_code, '^client-', '', 'i')) =
       upper(regexp_replace($${paramIndex}, '^client-', '', 'i'))
  )`;
}

export async function canUserTrashDealer(
  pool: PoolLike,
  userId: string,
  role: string,
  dealerId: string,
): Promise<DealerScopeCheck> {
  const normalized = normalizeRole(role);
  if (normalized === "unknown") return { allowed: false, reason: "unknown_role" };
  if (NO_ACCESS.has(normalized)) return { allowed: false, reason: "role_no_trash_access" };
  if (FULL_VIEW.has(normalized)) return { allowed: true };

  if (normalized === "manager" || normalized === "sales_manager") {
    const n = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM client_assignments
        WHERE responsible_user_id = $1::uuid
          AND ${sqlClientCodeMatchesDealerId(2)}`,
      [userId, dealerId],
    );
    return { allowed: n > 0, reason: n > 0 ? undefined : "not_in_manager_assignments" };
  }

  if (normalized === "regional_manager") {
    const overrideCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM dealer_overrides
        WHERE dealer_id = $1
          AND regional_manager_id = $2::uuid`,
      [dealerId, userId],
    );
    if (overrideCount > 0) return { allowed: true };

    const assignmentCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM client_assignments
        WHERE responsible_user_id = $1::uuid
          AND ${sqlClientCodeMatchesDealerId(2)}`,
      [userId, dealerId],
    );
    return { allowed: assignmentCount > 0, reason: assignmentCount > 0 ? undefined : "not_in_regional_scope" };
  }

  if (normalized === "rop") {
    const grantCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM rop_client_grants
        WHERE rop_user_id = $1::uuid
          AND ${sqlClientCodeMatchesDealerId(2)}`,
      [userId, dealerId],
    );
    if (grantCount > 0) return { allowed: true };

    const teamCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM client_assignments ca
         INNER JOIN teams t ON t.id = ca.team_id
        WHERE t.rop_user_id = $1::uuid
          AND ${sqlClientCodeMatchesDealerId(2)}`,
      [userId, dealerId],
    );
    if (teamCount > 0) return { allowed: true };

    const ownCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM client_assignments
        WHERE responsible_user_id = $1::uuid
          AND ${sqlClientCodeMatchesDealerId(2)}`,
      [userId, dealerId],
    );
    if (ownCount > 0) return { allowed: true };

    const ropOverrideCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM dealer_overrides
        WHERE dealer_id = $1
          AND rop_id = $2::uuid`,
      [dealerId, userId],
    );
    return { allowed: ropOverrideCount > 0, reason: ropOverrideCount > 0 ? undefined : "not_in_rop_scope" };
  }

  return { allowed: false, reason: "unknown_role" };
}

export async function canUserTrashTradePoint(
  pool: PoolLike,
  userId: string,
  role: string,
  tpId: string,
): Promise<DealerScopeCheck> {
  const normalized = normalizeRole(role);
  if (normalized === "unknown") return { allowed: false, reason: "unknown_role" };
  if (NO_ACCESS.has(normalized)) return { allowed: false, reason: "role_no_trash_access" };
  if (FULL_VIEW.has(normalized)) return { allowed: true };

  if (normalized === "regional_manager") {
    const tpOverrideCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM trade_point_overrides
        WHERE tp_id = $1
          AND regional_manager_id = $2::uuid`,
      [tpId, userId],
    );
    if (tpOverrideCount > 0) return { allowed: true };
  }

  if (normalized === "rop") {
    const tpGrantCount = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
         FROM rop_client_grants
        WHERE rop_user_id = $1::uuid
          AND trade_point_id = $2`,
      [userId, tpId],
    );
    if (tpGrantCount > 0) return { allowed: true };
  }

  const tp = await pool.query<{ dealer_id: string | null }>(
    `SELECT dealer_id FROM trade_point_overrides WHERE tp_id = $1 LIMIT 1`,
    [tpId],
  );
  const dealerId = tp.rows[0]?.dealer_id?.trim() ?? "";
  if (!dealerId) return { allowed: false, reason: "tp_without_dealer" };

  return canUserTrashDealer(pool, userId, role, dealerId);
}
