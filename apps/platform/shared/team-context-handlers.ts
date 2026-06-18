/**
 * GET /api/team/context — teamId, teamMemberIds, teamCodes для RBAC корзины/архива (Промт 398).
 */
import type { PoolLike } from "./admin/admin-auth.js";
import { fetchMyClientCodes } from "./my-client-codes-handlers.js";

export type TeamContextPayload = {
  success: true;
  teamId: string | null;
  teamMemberIds: string[];
  teamCodes: string[];
};

type SessionUser = { id: string; role: string };

async function teamIdForUser(pool: PoolLike, userId: string, role: string): Promise<string | null> {
  if (role === "rop") {
    const r = await pool.query<{ id: string }>(
      `SELECT id FROM teams WHERE rop_user_id = $1::uuid ORDER BY name LIMIT 1`,
      [userId],
    );
    if (r.rows[0]?.id) return r.rows[0].id;
  }
  const utm = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM user_team_memberships WHERE user_id = $1::uuid ORDER BY team_id LIMIT 1`,
    [userId],
  );
  return utm.rows[0]?.team_id ?? null;
}

async function teamMemberIdsForUser(pool: PoolLike, user: SessionUser, teamId: string | null): Promise<string[]> {
  const uid = user.id;
  const role = user.role;
  const ids = new Set<string>([uid]);

  if (role === "rop" && teamId) {
    const r = await pool.query<{ id: string }>(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN user_team_memberships utm ON utm.user_id = u.id
       WHERE utm.team_id = $1::uuid AND u.status IN ('active', 'invited')`,
      [teamId],
    );
    for (const row of r.rows) ids.add(row.id);
    return [...ids];
  }

  if ((role === "regional_manager" || role === "manager") && teamId) {
    const r = await pool.query<{ id: string }>(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN user_team_memberships utm ON utm.user_id = u.id
       WHERE utm.team_id = $1::uuid AND u.status IN ('active', 'invited')`,
      [teamId],
    );
    for (const row of r.rows) ids.add(row.id);
    return [...ids];
  }

  return [uid];
}

export async function fetchTeamContext(pool: PoolLike, user: SessionUser): Promise<TeamContextPayload> {
  const role = user.role;
  if (
    role === "admin" ||
    role === "director" ||
    role === "analyst" ||
    role === "marketer" ||
    role === "category_manager"
  ) {
    return { success: true, teamId: null, teamMemberIds: [], teamCodes: [] };
  }

  const teamId = await teamIdForUser(pool, user.id, role);
  const teamMemberIds = await teamMemberIdsForUser(pool, user, teamId);
  const codes = await fetchMyClientCodes(pool, user);
  const teamCodes =
    role === "rop" || role === "regional_manager"
      ? [...new Set([...codes.teamCodes, ...codes.ownCodes, ...codes.grantedCodes])]
      : codes.ownCodes;

  return {
    success: true,
    teamId,
    teamMemberIds,
    teamCodes,
  };
}
