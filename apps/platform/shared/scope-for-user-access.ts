/**
 * RBAC: просмотр scope другого пользователя (Промт 387).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";

export type ScopeTargetUser = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  status: string;
};

async function countRows(pool: PoolLike, sql: string, params: unknown[]): Promise<number> {
  const r = await pool.query<{ c: string }>(sql, params);
  return Number(r.rows[0]?.c ?? 0);
}

export async function fetchScopeTargetUser(
  pool: PoolLike,
  userId: string,
): Promise<ScopeTargetUser | null> {
  const r = await pool.query<ScopeTargetUser>(
    `SELECT id::text AS id, email, role, full_name, status
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

export async function canViewerAccessUserScope(
  pool: PoolLike,
  viewerId: string,
  viewerRole: UserRole,
  targetUserId: string,
): Promise<boolean> {
  if (viewerId === targetUserId) return true;
  if (viewerRole === "admin" || viewerRole === "director") return true;

  if (viewerRole === "manager" || viewerRole === "marketer" || viewerRole === "analyst" || viewerRole === "category_manager") {
    return false;
  }

  if (viewerRole === "rop") {
    const n = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
       FROM user_team_memberships target_m
       INNER JOIN teams t ON t.id = target_m.team_id
       WHERE target_m.user_id = $2::uuid AND t.rop_user_id = $1::uuid`,
      [viewerId, targetUserId],
    );
    return n > 0;
  }

  if (viewerRole === "regional_manager") {
    const n = await countRows(
      pool,
      `SELECT COUNT(*)::text AS c
       FROM user_team_memberships viewer_m
       INNER JOIN user_team_memberships target_m ON target_m.team_id = viewer_m.team_id
       WHERE viewer_m.user_id = $1::uuid AND target_m.user_id = $2::uuid`,
      [viewerId, targetUserId],
    );
    return n > 0;
  }

  return false;
}
