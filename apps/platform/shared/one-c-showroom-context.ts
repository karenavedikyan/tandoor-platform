/**
 * LK hierarchy + 1C name matching context for /1c/* showroom.
 */

import type { PoolLike } from "../server/db/neon-client.js";
import {
  buildReverseNameLookup,
  findMatchingOneCNames,
  normalizeName,
} from "./one-c-name-matching.js";

export type LkUserRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  role_in_team: string;
  team_id: string;
};

export type TeamRow = {
  id: string;
  name: string;
  rop_user_id: string | null;
};

export type LegalIndexRow = {
  id_1c: string;
  regional_manager_name: string | null;
  responsible_manager_name: string | null;
};

export type StoreIndexRow = {
  id_1c: string;
  legal_entity_1c: string | null;
};

export type OneCShowroomContext = {
  teams: TeamRow[];
  usersById: Map<string, LkUserRow>;
  membershipsByTeam: Map<string, LkUserRow[]>;
  regionalNames: string[];
  responsibleNames: string[];
  matchedRegionalByUserId: Map<string, string[]>;
  matchedResponsibleByUserId: Map<string, string[]>;
  userIdByRegionalName: Map<string, string>;
  userIdByResponsibleName: Map<string, string>;
  activeManagerMatchedNames: string[];
  activeRmMatchedNames: string[];
  activeFilterNames: string[];
  legalById: Map<string, LegalIndexRow>;
  storeRows: StoreIndexRow[];
  storesTotal: number;
  legalsTotal: number;
  last_imported_at: string | null;
};

function uniqueStrings(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of Array.from(values)) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export async function loadOneCShowroomContext(pool: PoolLike): Promise<OneCShowroomContext> {
  const [teamsRes, membersRes, ropsRes, regionalRes, responsibleRes, legalsRes, storesRes, metaRes] =
    await Promise.all([
      pool.query<TeamRow>(
        `SELECT id::text, name, rop_user_id::text
         FROM teams
         WHERE rop_user_id IS NOT NULL
         ORDER BY name ASC`,
      ),
      pool.query<LkUserRow>(
        `SELECT u.id::text AS id, u.full_name, u.phone, u.email, u.role::text AS role,
                m.role_in_team, m.team_id::text AS team_id
         FROM user_team_memberships m
         INNER JOIN users u ON u.id = m.user_id
         WHERE u.status = 'active'
           AND m.role_in_team IN ('rop', 'regional_manager', 'manager')
         ORDER BY u.full_name ASC`,
      ),
      pool.query<LkUserRow>(
        `SELECT u.id::text AS id, u.full_name, u.phone, u.email, u.role::text AS role,
                'rop'::text AS role_in_team, t.id::text AS team_id
         FROM teams t
         INNER JOIN users u ON u.id = t.rop_user_id
         WHERE u.status = 'active' AND t.rop_user_id IS NOT NULL`,
      ),
      pool.query<{ name: string }>(
        `SELECT DISTINCT regional_manager_name AS name
         FROM exchange_legals_raw
         WHERE regional_manager_name IS NOT NULL AND btrim(regional_manager_name) <> ''`,
      ),
      pool.query<{ name: string }>(
        `SELECT DISTINCT responsible_manager_name AS name
         FROM exchange_legals_raw
         WHERE responsible_manager_name IS NOT NULL AND btrim(responsible_manager_name) <> ''`,
      ),
      pool.query<LegalIndexRow>(
        `SELECT id_1c::text, regional_manager_name, responsible_manager_name
         FROM exchange_legals_raw`,
      ),
      pool.query<StoreIndexRow>(
        `SELECT id_1c::text, legal_entity_1c::text
         FROM exchange_stores_raw`,
      ),
      pool.query<{
        stores_total: number;
        legals_total: number;
        last_imported_at: string | null;
      }>(
        `SELECT
           (SELECT COUNT(*)::int FROM exchange_stores_raw) AS stores_total,
           (SELECT COUNT(*)::int FROM exchange_legals_raw) AS legals_total,
           GREATEST(
             COALESCE((SELECT MAX(imported_at) FROM exchange_stores_raw), 'epoch'::timestamptz),
             COALESCE((SELECT MAX(imported_at) FROM exchange_users_raw), 'epoch'::timestamptz),
             COALESCE((SELECT MAX(imported_at) FROM exchange_legals_raw), 'epoch'::timestamptz)
           ) AS last_imported_at`,
      ),
    ]);

  const regionalNames = regionalRes.rows.map((r) => r.name);
  const responsibleNames = responsibleRes.rows.map((r) => r.name);

  const usersById = new Map<string, LkUserRow>();
  const membershipsByTeam = new Map<string, LkUserRow[]>();
  const allMemberRows = [...ropsRes.rows, ...membersRes.rows];
  for (const row of allMemberRows) {
    usersById.set(row.id, row);
    const list = membershipsByTeam.get(row.team_id) ?? [];
    if (!list.some((x) => x.id === row.id && x.role_in_team === row.role_in_team)) {
      list.push(row);
    }
    membershipsByTeam.set(row.team_id, list);
  }

  const rmUsers = allMemberRows.filter((u) => u.role_in_team === "regional_manager");
  const mgrUsers = allMemberRows.filter((u) => u.role_in_team === "manager");

  const matchedRegionalByUserId = new Map<string, string[]>();
  const matchedResponsibleByUserId = new Map<string, string[]>();

  for (const u of rmUsers) {
    matchedRegionalByUserId.set(u.id, findMatchingOneCNames(u.full_name, regionalNames));
  }
  for (const u of mgrUsers) {
    matchedResponsibleByUserId.set(u.id, findMatchingOneCNames(u.full_name, responsibleNames));
  }

  const userIdByRegionalName = buildReverseNameLookup(rmUsers, regionalNames);
  const userIdByResponsibleName = buildReverseNameLookup(mgrUsers, responsibleNames);

  const activeManagerMatchedNames = uniqueStrings(
    mgrUsers.flatMap((u) => matchedResponsibleByUserId.get(u.id) ?? []),
  );
  const activeRmMatchedNames = uniqueStrings(
    rmUsers.flatMap((u) => matchedRegionalByUserId.get(u.id) ?? []),
  );
  const activeFilterNames = uniqueStrings([...activeManagerMatchedNames, ...activeRmMatchedNames]);

  const legalById = new Map(legalsRes.rows.map((l) => [l.id_1c, l]));
  const meta = metaRes.rows[0];

  return {
    teams: teamsRes.rows,
    usersById,
    membershipsByTeam,
    regionalNames,
    responsibleNames,
    matchedRegionalByUserId,
    matchedResponsibleByUserId,
    userIdByRegionalName,
    userIdByResponsibleName,
    activeManagerMatchedNames,
    activeRmMatchedNames,
    activeFilterNames,
    legalById,
    storeRows: storesRes.rows,
    storesTotal: meta?.stores_total ?? 0,
    legalsTotal: meta?.legals_total ?? 0,
    last_imported_at:
      meta?.last_imported_at && meta.last_imported_at !== "1970-01-01T00:00:00.000Z"
        ? String(meta.last_imported_at)
        : null,
  };
}

export function legalMatchesActiveFilter(legal: LegalIndexRow, ctx: OneCShowroomContext): boolean {
  const resp = legal.responsible_manager_name;
  const reg = legal.regional_manager_name;
  if (resp && ctx.activeManagerMatchedNames.includes(resp)) return true;
  if (reg && ctx.activeRmMatchedNames.includes(reg)) return true;
  return false;
}

export function countLegalsForRegionalNames(names: string[], ctx: OneCShowroomContext): number {
  if (names.length === 0) return 0;
  const set = new Set(names);
  let n = 0;
  for (const l of Array.from(ctx.legalById.values())) {
    if (l.regional_manager_name && set.has(l.regional_manager_name)) n++;
  }
  return n;
}

export function countLegalsForResponsibleNames(names: string[], ctx: OneCShowroomContext): number {
  if (names.length === 0) return 0;
  const set = new Set(names);
  let n = 0;
  for (const l of Array.from(ctx.legalById.values())) {
    if (l.responsible_manager_name && set.has(l.responsible_manager_name)) n++;
  }
  return n;
}

export function storeIdsForRegionalNames(names: string[], ctx: OneCShowroomContext): Set<string> {
  const result = new Set<string>();
  if (names.length === 0) return result;
  const nameSet = new Set(names);
  const legalIds = new Set<string>();
  for (const l of Array.from(ctx.legalById.values())) {
    if (l.regional_manager_name && nameSet.has(l.regional_manager_name)) {
      legalIds.add(l.id_1c);
    }
  }
  for (const s of ctx.storeRows) {
    if (s.legal_entity_1c && legalIds.has(s.legal_entity_1c)) {
      result.add(s.id_1c);
    }
  }
  return result;
}

export function storeIdsForResponsibleNames(names: string[], ctx: OneCShowroomContext): Set<string> {
  const result = new Set<string>();
  if (names.length === 0) return result;
  const nameSet = new Set(names);
  const legalIds = new Set<string>();
  for (const l of Array.from(ctx.legalById.values())) {
    if (l.responsible_manager_name && nameSet.has(l.responsible_manager_name)) {
      legalIds.add(l.id_1c);
    }
  }
  for (const s of ctx.storeRows) {
    if (s.legal_entity_1c && legalIds.has(s.legal_entity_1c)) {
      result.add(s.id_1c);
    }
  }
  return result;
}

export function countStoresActive(ctx: OneCShowroomContext): number {
  return storeIdsForResponsibleNames(ctx.activeManagerMatchedNames, ctx).size;
}

export function countLegalsActive(ctx: OneCShowroomContext): number {
  let n = 0;
  for (const l of Array.from(ctx.legalById.values())) {
    if (legalMatchesActiveFilter(l, ctx)) n++;
  }
  return n;
}

export type OneCManagerNode = {
  userId: string;
  fullName: string;
  phone: string | null;
  storeCount: number;
  legalCount: number;
  hasMatch: boolean;
};

export type OneCRmNode = {
  userId: string;
  fullName: string;
  phone: string | null;
  storeCount: number;
  legalCount: number;
  hasMatch: boolean;
  managers: OneCManagerNode[];
};

export type OneCRopNode = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  teamId: string;
  teamName: string;
  rmCount: number;
  managerCount: number;
  storeCount: number;
  legalCount: number;
  rms: OneCRmNode[];
  managers: OneCManagerNode[];
};

function teamManagers(teamId: string, ctx: OneCShowroomContext): LkUserRow[] {
  return (ctx.membershipsByTeam.get(teamId) ?? []).filter((m) => m.role_in_team === "manager");
}

function teamRms(teamId: string, ctx: OneCShowroomContext): LkUserRow[] {
  return (ctx.membershipsByTeam.get(teamId) ?? []).filter((m) => m.role_in_team === "regional_manager");
}

function buildManagerNode(user: LkUserRow, ctx: OneCShowroomContext): OneCManagerNode {
  const names = ctx.matchedResponsibleByUserId.get(user.id) ?? [];
  return {
    userId: user.id,
    fullName: user.full_name,
    phone: user.phone,
    storeCount: storeIdsForResponsibleNames(names, ctx).size,
    legalCount: countLegalsForResponsibleNames(names, ctx),
    hasMatch: names.length > 0,
  };
}

function buildRmNode(user: LkUserRow, ctx: OneCShowroomContext): OneCRmNode {
  const names = ctx.matchedRegionalByUserId.get(user.id) ?? [];
  return {
    userId: user.id,
    fullName: user.full_name,
    phone: user.phone,
    storeCount: storeIdsForRegionalNames(names, ctx).size,
    legalCount: countLegalsForRegionalNames(names, ctx),
    hasMatch: names.length > 0,
    managers: [],
  };
}

export function ropCountsFromTeamManagers(
  teamId: string,
  ctx: OneCShowroomContext,
): { storeCount: number; legalCount: number } {
  const teamMgrs = teamManagers(teamId, ctx);
  const ropStoreIds = new Set<string>();
  const ropLegalIds = new Set<string>();
  for (const mgr of teamMgrs) {
    const names = ctx.matchedResponsibleByUserId.get(mgr.id) ?? [];
    for (const id of Array.from(storeIdsForResponsibleNames(names, ctx))) {
      ropStoreIds.add(id);
    }
    const nameSet = new Set(names);
    for (const l of Array.from(ctx.legalById.values())) {
      if (l.responsible_manager_name && nameSet.has(l.responsible_manager_name)) {
        ropLegalIds.add(l.id_1c);
      }
    }
  }
  return { storeCount: ropStoreIds.size, legalCount: ropLegalIds.size };
}

export function buildHierarchy(ctx: OneCShowroomContext, searchQ = ""): OneCRopNode[] {
  const q = normalizeName(searchQ);
  const nodes: OneCRopNode[] = [];

  for (const team of ctx.teams) {
    if (!team.rop_user_id) continue;
    const rop = ctx.usersById.get(team.rop_user_id);
    if (!rop) continue;

    const rms = teamRms(team.id, ctx).map((rm) => buildRmNode(rm, ctx));
    const managers = teamManagers(team.id, ctx).map((m) => buildManagerNode(m, ctx));
    const { storeCount, legalCount } = ropCountsFromTeamManagers(team.id, ctx);

    const node: OneCRopNode = {
      userId: rop.id,
      fullName: rop.full_name,
      phone: rop.phone,
      email: rop.email,
      teamId: team.id,
      teamName: team.name,
      rmCount: rms.length,
      managerCount: managers.length,
      storeCount,
      legalCount,
      rms,
      managers,
    };

    if (!q) {
      nodes.push(node);
      continue;
    }

    const ropHit = normalizeName(node.fullName).includes(q);
    const filteredRms = ropHit
      ? node.rms
      : node.rms.filter((rm) => normalizeName(rm.fullName).includes(q));
    const filteredManagers = ropHit
      ? node.managers
      : node.managers.filter((m) => normalizeName(m.fullName).includes(q));
    if (ropHit || filteredRms.length > 0 || filteredManagers.length > 0) {
      nodes.push({ ...node, rms: filteredRms, managers: filteredManagers });
    }
  }

  return nodes;
}

export function countRmsWithMatch(ctx: OneCShowroomContext): number {
  let n = 0;
  for (const u of Array.from(ctx.usersById.values())) {
    if (u.role_in_team !== "regional_manager") continue;
    if ((ctx.matchedRegionalByUserId.get(u.id) ?? []).length > 0) n++;
  }
  return n;
}

export function countManagersWithMatch(ctx: OneCShowroomContext): number {
  let n = 0;
  for (const u of Array.from(ctx.usersById.values())) {
    if (u.role_in_team !== "manager") continue;
    if ((ctx.matchedResponsibleByUserId.get(u.id) ?? []).length > 0) n++;
  }
  return n;
}

export function teamContextForUser(
  userId: string,
  ctx: OneCShowroomContext,
): {
  team: TeamRow | null;
  rop: LkUserRow | null;
  rms: LkUserRow[];
} {
  const user = ctx.usersById.get(userId);
  if (!user) return { team: null, rop: null, rms: [] };
  const team = ctx.teams.find((t) => t.id === user.team_id) ?? null;
  const rop = team?.rop_user_id ? (ctx.usersById.get(team.rop_user_id) ?? null) : null;
  const rms = team ? teamRms(team.id, ctx) : [];
  return { team, rop, rms };
}
