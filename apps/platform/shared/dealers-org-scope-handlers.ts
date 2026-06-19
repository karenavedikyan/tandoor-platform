/**
 * GET /api/dealers/org-scope — scope всей орг-структуры из БД (Промт 423).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import {
  aggregateMemberTotals,
  aggregateOrgTotals,
} from "./dealers-scope-aggregation.js";
import type { OrgScopePayload, TeamScopeMember } from "./dealers-scope-types.js";
import {
  buildMemberScope,
  buildTeamScopePayload,
  type TeamScopeViewer,
} from "./dealers-team-scope-handlers.js";

type TeamRow = {
  id: string;
  name: string;
  rop_user_id: string | null;
  rop_name: string | null;
  rop_email: string | null;
};

const ORG_SCOPE_ROLES: ReadonlySet<UserRole> = new Set(["director", "admin"]);

export function canViewerAccessOrgScope(role: UserRole): boolean {
  return ORG_SCOPE_ROLES.has(role);
}

async function fetchAllTeams(pool: PoolLike): Promise<TeamRow[]> {
  const r = await pool.query<TeamRow>(
    `SELECT t.id::text AS id, t.name,
            t.rop_user_id::text AS rop_user_id,
            rop.full_name AS rop_name,
            rop.email AS rop_email
     FROM teams t
     LEFT JOIN users rop ON rop.id = t.rop_user_id
     ORDER BY t.name`,
  );
  return r.rows;
}

async function fetchOrphanRegionalManagers(pool: PoolLike): Promise<
  { id: string; email: string; role: UserRole; full_name: string | null }[]
> {
  const r = await pool.query<{ id: string; email: string; role: UserRole; full_name: string | null }>(
    `SELECT DISTINCT u.id::text AS id, u.email, u.role, u.full_name
     FROM users u
     WHERE u.role = 'regional_manager'
       AND u.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM user_team_memberships m
         INNER JOIN teams t ON t.id = m.team_id
         WHERE m.user_id = u.id
           AND m.role IN ('manager', 'regional_manager')
       )
     ORDER BY u.full_name, u.email`,
  );
  return r.rows;
}

function keysFromMembers(members: TeamScopeMember[]): { active: Set<string>; trashed: Set<string> } {
  const active = new Set<string>();
  const trashed = new Set<string>();
  for (const m of members) {
    for (const k of m.active_dealer_external_keys) active.add(k);
    for (const k of m.trashed_dealer_external_keys) trashed.add(k);
  }
  return { active, trashed };
}

async function buildOrphanBlock(
  pool: PoolLike,
  coveredActive: Set<string>,
  coveredTrashed: Set<string>,
): Promise<OrgScopePayload["orphan"]> {
  const regionalManagers = await fetchOrphanRegionalManagers(pool);
  const rmMembers = await Promise.all(regionalManagers.map((rm) => buildMemberScope(pool, rm)));

  const unassignedActive: string[] = [];
  const unassignedTrashed: string[] = [];

  const orphanDealersQ = await pool.query<{ external_key: string; status: string | null }>(
    `SELECT DISTINCT d.external_key, d_ov.status::text AS status
     FROM dealer_overrides d_ov
     INNER JOIN dealers d ON (
       d_ov.dealer_id = d.id::text
       OR d_ov.dealer_id = d.external_key
       OR (d.release_code IS NOT NULL AND lower(d_ov.dealer_id) = 'client-' || lower(d.release_code))
     )
     WHERE NOT EXISTS (
       SELECT 1 FROM client_assignments ca
       WHERE ca.client_code = d.release_code
          OR ca.client_code = d.external_key
     )`,
  );

  for (const row of orphanDealersQ.rows) {
    const key = row.external_key;
    const status = row.status ?? "active";
    if (status === "in_trash") {
      if (!coveredTrashed.has(key)) unassignedTrashed.push(key);
    } else if (status === "active" || status == null) {
      if (!coveredActive.has(key)) unassignedActive.push(key);
    }
  }

  const syntheticMember: TeamScopeMember | null =
    unassignedActive.length > 0 || unassignedTrashed.length > 0
      ? {
          user: {
            id: "__orphan_dealers__",
            name: "Без закрепления",
            email: "",
            role: "manager",
          },
          totals: {
            active_dealers: unassignedActive.length,
            active_trade_points: 0,
            trashed_dealers: unassignedTrashed.length,
            trashed_trade_points: 0,
          },
          active_dealer_external_keys: unassignedActive,
          trashed_dealer_external_keys: unassignedTrashed,
          active_trade_points: [],
        }
      : null;

  const members = [...rmMembers, ...(syntheticMember ? [syntheticMember] : [])];
  return {
    label: "Без команды",
    members,
    totals: aggregateMemberTotals(members),
  };
}

export async function fetchOrgScopeForRequest(
  pool: PoolLike,
  viewer: TeamScopeViewer,
): Promise<OrgScopePayload | { forbidden: true }> {
  if (!canViewerAccessOrgScope(viewer.role)) return { forbidden: true };

  const teams = await fetchAllTeams(pool);
  const teamBlocks = await Promise.all(teams.map((t) => buildTeamScopePayload(pool, t)));

  const orgTeams = teamBlocks.map((block) => ({
    team: {
      id: block.team.id,
      name: block.team.name,
      rop: block.team.rop.id ? block.team.rop : null,
    },
    members: block.members,
    team_totals: block.team_totals,
  }));

  const allTeamMembers = teamBlocks.flatMap((b) => b.members);
  const covered = keysFromMembers(allTeamMembers);

  const orphan = await buildOrphanBlock(pool, covered.active, covered.trashed);

  const allMembers = [...allTeamMembers, ...orphan.members];
  const org_totals = aggregateOrgTotals(
    teamBlocks.map((b) => b.team_totals),
    orphan.totals,
    allMembers,
  );

  const orgNameQ = await pool.query<{ name: string }>(
    `SELECT COALESCE((SELECT name FROM teams ORDER BY name LIMIT 1), 'Организация') AS name`,
  );

  return {
    success: true,
    org: { id: "org", name: orgNameQ.rows[0]?.name ?? "Организация" },
    teams: orgTeams,
    orphan,
    org_totals,
  };
}
