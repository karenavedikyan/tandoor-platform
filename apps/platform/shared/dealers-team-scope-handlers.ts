/**
 * GET /api/dealers/team-scope — scope команды РОП из БД (Промт 423).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import { computeDbScopeForUser, computeDealerKpiTotalsForActiveDealers } from "./db-scope-formula.js";
import {
  fetchActiveTradePointsForScope,
  type MyDealerScopeTradePoint,
} from "./dealers-my-scope-handlers.js";
import { aggregateMemberTotals } from "./dealers-scope-aggregation.js";
import { finalizeKpiScopeTotals } from "./kpi-scope-totals.js";
import type { TeamScopeMember, TeamScopePayload } from "./dealers-scope-types.js";

export type TeamScopeViewer = {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
};

type TeamRow = {
  id: string;
  name: string;
  rop_user_id: string | null;
  rop_name: string | null;
  rop_email: string | null;
};

type MemberRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
};

const TEAM_MEMBER_ROLES = ["manager", "regional_manager"] as const;

export async function fetchTeamMembersForTeam(
  pool: PoolLike,
  teamId: string,
): Promise<MemberRow[]> {
  const r = await pool.query<MemberRow>(
    `SELECT u.id::text AS id, u.email, u.role, u.full_name
     FROM user_team_memberships m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.team_id = $1::uuid
       AND m.role_in_team IN ('manager', 'regional_manager')
       AND u.status = 'active'
     ORDER BY u.full_name, u.email`,
    [teamId],
  );
  return r.rows;
}

export async function buildMemberScope(
  pool: PoolLike,
  member: MemberRow,
): Promise<TeamScopeMember> {
  const scope = await computeDbScopeForUser(pool, member.id, member.role);
  const activeTradePoints = await fetchActiveTradePointsForScope(pool, scope);
  return {
    user: {
      id: member.id,
      name: member.full_name?.trim() || member.email,
      email: member.email,
      role: member.role,
    },
    totals: {
      active_dealers: scope.totals.active_dealers,
      active_trade_points: scope.totals.active_trade_points,
      trashed_dealers: scope.totals.trashed_dealers,
      trashed_trade_points: scope.totals.trashed_trade_points,
      tp_status_active: scope.totals.tp_status_active,
      tp_status_potential: scope.totals.tp_status_potential,
      tp_status_attention: scope.totals.tp_status_attention,
      dealer_no_status: scope.totals.dealer_no_status,
      avg_distribution: scope.totals.avg_distribution,
    },
    active_dealer_ids: scope.active_dealer_ids,
    active_dealer_external_keys: scope.active_dealer_external_keys,
    trashed_dealer_external_keys: scope.trashed_dealer_external_keys,
    active_trade_points: activeTradePoints.map((tp: MyDealerScopeTradePoint) => ({
      tp_id: tp.tp_id,
      dealer_id: tp.dealer_id,
      is_primary: tp.is_primary,
    })),
  };
}

export async function buildTeamScopePayload(
  pool: PoolLike,
  team: TeamRow,
): Promise<TeamScopePayload> {
  const members = await fetchTeamMembersForTeam(pool, team.id);
  const memberScopes = await Promise.all(members.map((m) => buildMemberScope(pool, m)));
  const ropId = team.rop_user_id ?? "";
  const unionDealerIds = new Set<string>();
  for (const m of memberScopes) {
    for (const id of m.active_dealer_ids) unionDealerIds.add(id);
  }
  const kpiFields = finalizeKpiScopeTotals(
    await computeDealerKpiTotalsForActiveDealers(pool, Array.from(unionDealerIds)),
  );
  const countTotals = aggregateMemberTotals(memberScopes);
  return {
    success: true,
    team: {
      id: team.id,
      name: team.name,
      rop: {
        id: ropId,
        name: team.rop_name?.trim() || "—",
        email: team.rop_email?.trim() || "",
      },
    },
    members: memberScopes,
    team_totals: { ...countTotals, ...kpiFields },
  };
}

async function resolveTeamByRopUserId(pool: PoolLike, ropUserId: string): Promise<TeamRow | null> {
  const r = await pool.query<TeamRow>(
    `SELECT t.id::text AS id, t.name,
            t.rop_user_id::text AS rop_user_id,
            rop.full_name AS rop_name,
            rop.email AS rop_email
     FROM teams t
     LEFT JOIN users rop ON rop.id = t.rop_user_id
     WHERE t.rop_user_id = $1::uuid
     LIMIT 1`,
    [ropUserId],
  );
  return r.rows[0] ?? null;
}

async function resolveTeamForRopViewer(pool: PoolLike, viewerId: string): Promise<TeamRow | null> {
  return resolveTeamByRopUserId(pool, viewerId);
}

export async function canViewerAccessTeamScope(
  pool: PoolLike,
  viewerId: string,
  viewerRole: UserRole,
  ropUserId: string,
): Promise<boolean> {
  if (viewerRole === "admin" || viewerRole === "director") return true;
  if (viewerRole === "rop") return viewerId === ropUserId;
  return false;
}

export async function fetchTeamScopeForRequest(
  pool: PoolLike,
  viewer: TeamScopeViewer,
  ropUserId?: string | null,
): Promise<TeamScopePayload | { forbidden: true } | { notFound: true }> {
  const targetRopId = ropUserId?.trim() || viewer.id;

  const allowed = await canViewerAccessTeamScope(pool, viewer.id, viewer.role, targetRopId);
  if (!allowed) return { forbidden: true };

  const team =
    viewer.role === "rop" && !ropUserId?.trim()
      ? await resolveTeamForRopViewer(pool, viewer.id)
      : await resolveTeamByRopUserId(pool, targetRopId);

  if (!team) return { notFound: true };

  return buildTeamScopePayload(pool, team);
}

export { TEAM_MEMBER_ROLES };
