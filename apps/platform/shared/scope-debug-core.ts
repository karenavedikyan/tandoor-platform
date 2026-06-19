/**
 * Ядро GET /api/admin/scope-debug — без admin-auth (тестируемо без Neon).
 * Промт 384: счётчики из computeDbScopeForUser (БД source of truth).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import { computeDbScopeForUser, resolveScopeCodesMeta } from "./db-scope-formula.js";

export type ScopeDebugUserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type ScopeDebugTeamRow = {
  id: string;
  name: string;
  rop_user_id: string | null;
  role_in_team: string | null;
};

export type ScopeDebugPayload = {
  success: true;
  user: { id: string; email: string; full_name: string; role: UserRole };
  teams: ScopeDebugTeamRow[];
  scope: {
    own_client_codes: string[];
    team_client_codes: string[];
    granted_client_codes: string[];
    visible_dealer_count: number;
    visible_trade_point_count: number;
    trashed_in_scope_count: number;
    catalog_dealer_count: number;
    visible_codes_count: number | null;
    assignments_active: boolean;
  };
  explanation: string[];
};

export async function loadUserTeams(pool: PoolLike, userId: string): Promise<ScopeDebugTeamRow[]> {
  const r = await pool.query<{
    id: string;
    name: string;
    rop_user_id: string | null;
    role_in_team: string | null;
  }>(
    `SELECT t.id, t.name, t.rop_user_id, m.role AS role_in_team
     FROM user_team_memberships m
     INNER JOIN teams t ON t.id = m.team_id
     WHERE m.user_id = $1::uuid
     ORDER BY t.name`,
    [userId],
  );
  return r.rows;
}

function buildDbScopeExplanation(
  role: UserRole,
  meta: Awaited<ReturnType<typeof resolveScopeCodesMeta>>,
  totals: Awaited<ReturnType<typeof computeDbScopeForUser>>["totals"],
): string[] {
  const lines: string[] = [];
  lines.push("source of truth: shared/db-scope-formula.ts → computeDbScopeForUser (Промт 384)");
  if (meta.fullCatalog) {
    lines.push(`role=${role}: full catalog (all dealers table rows)`);
  } else if (role === "rop") {
    lines.push("rop: own ∪ team(client_assignments.team_id ∈ my teams) ∪ rop_client_grants");
    lines.push(
      `codes: own=${meta.ownCodes.length}, team=${meta.teamCodes.length}, granted=${meta.grantedCodes.length}, all=${meta.allCodes.length}`,
    );
  } else if (role === "regional_manager") {
    lines.push("regional_manager: own ∪ team (user_team_memberships), без grants");
    lines.push(`codes: own=${meta.ownCodes.length}, team=${meta.teamCodes.length}, all=${meta.allCodes.length}`);
  } else if (role === "manager") {
    lines.push("manager: client_assignments WHERE responsible_user_id = me");
    lines.push(`codes: own=${meta.ownCodes.length}`);
  } else {
    lines.push(`role=${role}: scoped via client_assignments`);
  }
  lines.push(`teams: ${meta.teamIds.length} team_id(s)`);
  lines.push(
    `totals: active_dealers=${totals.active_dealers}, active_trade_points=${totals.active_trade_points}, trashed_dealers=${totals.trashed_dealers}`,
  );
  lines.push("dealers: dealers.release_code ∈ scope_codes; trash via dealer_overrides.status = 'in_trash'");
  lines.push("trade_points: tp.dealer_id ∈ active_dealers AND trade_point_overrides.status = 'active'");
  return lines;
}

export async function buildScopeDebugPayload(
  pool: PoolLike,
  target: ScopeDebugUserRow,
  _catalogOverride?: unknown,
): Promise<ScopeDebugPayload> {
  void _catalogOverride;
  const role = target.role as UserRole;
  const [meta, dbScope, teams, catalogCountQ] = await Promise.all([
    resolveScopeCodesMeta(pool, target.id, role),
    computeDbScopeForUser(pool, target.id, role),
    loadUserTeams(pool, target.id),
    pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM dealers`),
  ]);

  const catalogCount = Number(catalogCountQ.rows[0]?.n ?? 0);

  return {
    success: true,
    user: {
      id: target.id,
      email: target.email,
      full_name: target.full_name,
      role,
    },
    teams,
    scope: {
      own_client_codes: meta.ownCodes,
      team_client_codes: meta.teamCodes,
      granted_client_codes: meta.grantedCodes,
      visible_dealer_count: dbScope.totals.active_dealers,
      visible_trade_point_count: dbScope.totals.active_trade_points,
      trashed_in_scope_count: dbScope.totals.trashed_dealers,
      catalog_dealer_count: catalogCount,
      visible_codes_count: meta.fullCatalog ? null : meta.allCodes.length,
      assignments_active: meta.allCodes.length > 0 || meta.fullCatalog,
    },
    explanation: buildDbScopeExplanation(role, meta, dbScope.totals),
  };
}
