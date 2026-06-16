/**
 * Scope payloads для bootstrap и auth GET (Промт 380).
 */

import type { UserRole, UserStatus } from "./auth.js";
import type { DbUserRow, PoolLike } from "./admin/admin-auth.js";

export type VisibleClientsPayload = {
  all: boolean;
  codes: string[] | null;
  assignments: Array<{ code: string; responsibleUserId: string | null; teamId: string | null }> | null;
};

export type OrgSnapshotPayload = {
  success: true;
  me: { id: string; role: UserRole; fullName: string; teamId: string | null };
  visibility: {
    all: boolean;
    clientCodes: string[] | null;
    teamIds: string[];
    visibleUserIds: string[];
  };
  teams: Array<{ id: string; name: string; ropUserId: string | null; ropName: string | null }>;
  users: Array<{ id: string; fullName: string; role: UserRole; status: UserStatus; teamId: string | null }>;
};

type ClientAssignmentRow = {
  client_code: string;
  responsible_user_id: string | null;
  team_id: string | null;
};

export function publicUserDtoFromRow(r: DbUserRow): Record<string, unknown> {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    role: r.role as UserRole,
    status: r.status as UserStatus,
    mustChangePassword: r.must_change_password,
    lastLoginAt: r.last_login_at,
    phone: r.phone ?? null,
    createdAt: r.created_at ?? null,
  };
}

export async function buildVisibleClientsPayload(pool: PoolLike, row: DbUserRow): Promise<VisibleClientsPayload> {
  const role = row.role as UserRole;
  if (role === "admin" || role === "director" || role === "analyst" || role === "marketer" || role === "category_manager") {
    return { all: true, codes: null, assignments: null };
  }
  if (role === "rop") {
    const q = await pool.query<ClientAssignmentRow>(
      `SELECT DISTINCT ON (ca.client_code) ca.client_code, ca.responsible_user_id, ca.team_id
       FROM client_assignments ca
       INNER JOIN teams t ON t.id = ca.team_id
       WHERE t.rop_user_id = $1::uuid
       ORDER BY ca.client_code`,
      [row.id],
    );
    const grantedQ = await pool.query<ClientAssignmentRow>(
      `SELECT DISTINCT ON (g.client_code) g.client_code, ca.responsible_user_id, ca.team_id
       FROM rop_client_grants g
       LEFT JOIN client_assignments ca ON ca.client_code = g.client_code
       WHERE g.rop_user_id = $1::uuid
       ORDER BY g.client_code`,
      [row.id],
    );
    const byCode = new Map<string, ClientAssignmentRow>();
    for (const r of q.rows) if (r.client_code) byCode.set(r.client_code, r);
    for (const r of grantedQ.rows) if (r.client_code && !byCode.has(r.client_code)) byCode.set(r.client_code, r);
    const rows = Array.from(byCode.values());
    return {
      all: false,
      codes: rows.map((r) => r.client_code).filter(Boolean),
      assignments: rows.map((r) => ({
        code: r.client_code,
        responsibleUserId: r.responsible_user_id,
        teamId: r.team_id,
      })),
    };
  }
  if (role === "manager") {
    const q = await pool.query<ClientAssignmentRow>(
      `SELECT DISTINCT ON (client_code) client_code, responsible_user_id, team_id
       FROM client_assignments
       WHERE responsible_user_id = $1::uuid
       ORDER BY client_code`,
      [row.id],
    );
    const rows = q.rows;
    return {
      all: false,
      codes: rows.map((r) => r.client_code).filter(Boolean),
      assignments: rows.map((r) => ({
        code: r.client_code,
        responsibleUserId: r.responsible_user_id,
        teamId: r.team_id,
      })),
    };
  }
  if (role === "regional_manager") {
    const q = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT upper(regexp_replace(dealer_id, '^client-', '')) AS client_code
       FROM dealer_overrides
       WHERE regional_manager_id = $1::uuid
       ORDER BY client_code`,
      [row.id],
    );
    const codes = q.rows.map((r) => r.client_code).filter(Boolean);
    return {
      all: false,
      codes,
      assignments: codes.map((code) => ({
        code,
        responsibleUserId: row.id,
        teamId: null,
      })),
    };
  }
  return { all: false, codes: [], assignments: [] };
}

export async function buildOrgSnapshotPayload(pool: PoolLike, row: DbUserRow): Promise<OrgSnapshotPayload> {
  const meId = row.id;
  const role = row.role as UserRole;
  const meFullName = (row.full_name ?? "").trim() || row.email;

  const teamsRes = await pool.query<{ id: string; name: string; rop_user_id: string | null; rop_name: string | null }>(
    `SELECT t.id, t.name, t.rop_user_id, u.full_name AS rop_name
     FROM teams t
     LEFT JOIN users u ON u.id = t.rop_user_id
     ORDER BY t.name`,
  );
  const allTeams = teamsRes.rows;

  const usersRes = await pool.query<{
    id: string;
    full_name: string | null;
    role: UserRole;
    status: UserStatus;
    team_id: string | null;
  }>(
    `SELECT u.id, u.full_name, u.role, u.status, utm.team_id
     FROM users u
     LEFT JOIN user_team_memberships utm ON utm.user_id = u.id
     WHERE u.status IN ('active', 'invited')`,
  );

  type Agg = { id: string; fullName: string; role: UserRole; status: UserStatus; teamIds: Set<string> };
  const userAgg = new Map<string, Agg>();
  for (const r of usersRes.rows) {
    const fn = (r.full_name ?? "").trim() || "";
    let agg = userAgg.get(r.id);
    if (!agg) {
      agg = { id: r.id, fullName: fn, role: r.role, status: r.status, teamIds: new Set() };
      userAgg.set(r.id, agg);
    }
    if (r.team_id) agg.teamIds.add(r.team_id);
  }

  const ledTeamByRop = new Map<string, string>();
  for (const t of allTeams) {
    if (t.rop_user_id) ledTeamByRop.set(t.rop_user_id, t.id);
  }

  const utmMine = await pool.query<{ team_id: string }>(
    `SELECT team_id FROM user_team_memberships WHERE user_id = $1::uuid`,
    [meId],
  );
  const myUtmTeamIds = Array.from(new Set(utmMine.rows.map((r) => r.team_id).filter(Boolean)));

  let meTeamId: string | null = null;
  if (role === "rop") {
    meTeamId = ledTeamByRop.get(meId) ?? myUtmTeamIds[0] ?? null;
  } else if (role === "manager" || role === "regional_manager") {
    meTeamId = myUtmTeamIds[0] ?? null;
  }

  const vis = await buildVisibleClientsPayload(pool, row);

  const adminRes = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'admin' AND status IN ('active', 'invited')`,
  );
  const adminIds = new Set(adminRes.rows.map((r) => r.id));

  function membersOfTeams(teamIds: string[]): Set<string> {
    const ids = new Set<string>();
    const tset = new Set(teamIds);
    for (const agg of Array.from(userAgg.values())) {
      for (const tid of Array.from(agg.teamIds)) {
        if (tset.has(tid)) ids.add(agg.id);
      }
    }
    return ids;
  }

  let visibility: OrgSnapshotPayload["visibility"];
  let teamsOut: typeof allTeams;

  if (vis.all) {
    visibility = {
      all: true,
      clientCodes: null,
      teamIds: allTeams.map((t) => t.id),
      visibleUserIds: Array.from(userAgg.keys()),
    };
    teamsOut = allTeams;
  } else if (role === "rop") {
    const myLedTeamIds = allTeams.filter((t) => t.rop_user_id === meId).map((t) => t.id);
    const vu = new Set<string>([meId, ...Array.from(adminIds)]);
    for (const id of Array.from(membersOfTeams(myLedTeamIds))) vu.add(id);
    visibility = {
      all: false,
      clientCodes: vis.codes,
      teamIds: myLedTeamIds,
      visibleUserIds: Array.from(vu),
    };
    const allowT = new Set(myLedTeamIds);
    teamsOut = allTeams.filter((t) => allowT.has(t.id));
  } else if (role === "manager" || role === "regional_manager") {
    const tid = meTeamId ?? vis.assignments?.[0]?.teamId ?? null;
    const teamRow = tid ? allTeams.find((t) => t.id === tid) : undefined;
    const ropId = teamRow?.rop_user_id ?? null;
    const vu = new Set<string>([meId, ...Array.from(adminIds)]);
    if (ropId) vu.add(ropId);
    const teamIds = tid ? [tid] : [];
    visibility = {
      all: false,
      clientCodes: vis.codes,
      teamIds,
      visibleUserIds: Array.from(vu),
    };
    teamsOut = tid ? allTeams.filter((t) => t.id === tid) : [];
  } else {
    const teamIdSet = new Set<string>();
    for (const a of vis.assignments ?? []) {
      if (a.teamId) teamIdSet.add(a.teamId);
    }
    const vu = new Set<string>([meId, ...Array.from(adminIds)]);
    for (const a of vis.assignments ?? []) {
      if (a.responsibleUserId) vu.add(a.responsibleUserId);
    }
    visibility = {
      all: false,
      clientCodes: vis.codes,
      teamIds: Array.from(teamIdSet),
      visibleUserIds: Array.from(vu),
    };
    teamsOut = allTeams.filter((t) => teamIdSet.has(t.id));
  }

  const allowUsers = new Set(visibility.visibleUserIds);
  const usersOut = Array.from(userAgg.values())
    .filter((u) => allowUsers.has(u.id))
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      teamId: u.teamIds.size > 0 ? Array.from(u.teamIds)[0]! : ledTeamByRop.get(u.id) ?? null,
    }));

  if (role === "regional_manager" || role === "manager") {
    const meInList = usersOut.find((u) => u.id === meId);
    if (meInList) {
      if (meTeamId) meInList.teamId = meTeamId;
    } else {
      usersOut.push({
        id: meId,
        fullName: meFullName,
        role,
        status: "active",
        teamId: meTeamId,
      });
    }
  }

  return {
    success: true,
    me: { id: meId, role, fullName: meFullName, teamId: meTeamId },
    visibility,
    teams: teamsOut.map((t) => ({
      id: t.id,
      name: t.name,
      ropUserId: t.rop_user_id,
      ropName: t.rop_name,
    })),
    users: usersOut,
  };
}
