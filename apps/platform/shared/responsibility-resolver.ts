/**
 * Матрица ответственных — резолв менеджер / регионал / роп (Промт 233).
 */

import { normalizeTerritoryCityName } from "../client/src/lib/territory-city-normalize.js";

export type PoolLike = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
};

export type ResponsibleRole = "manager" | "regional_manager" | "rop";
export type ResolveSource = "assignment" | "legacy";
export type ResolveLevel = "trade_point" | "client" | "city" | "team";
export type ScopeKind = "trade_point" | "client" | "city";

export interface ResolvedResponsible {
  userId: string | null;
  userName: string | null;
  source: ResolveSource | null;
  sourceLevel: ResolveLevel | null;
}

export interface ResolvedResponsibles {
  manager: ResolvedResponsible;
  regional_manager: ResolvedResponsible;
  rop: ResolvedResponsible;
}

const ROLES: ResponsibleRole[] = ["manager", "regional_manager", "rop"];

const EMPTY: ResolvedResponsible = {
  userId: null,
  userName: null,
  source: null,
  sourceLevel: null,
};

type AssignmentRow = {
  scope_kind: string;
  scope_key: string;
  responsible_role: string;
  user_id: string;
  user_name: string | null;
};

type TradePointRow = {
  tp_id: string;
  dealer_id: string | null;
  name: string | null;
  city: string | null;
  address: string | null;
  regional_manager_id: string | null;
  regional_manager_name: string | null;
  rop_id: string | null;
  rop_name: string | null;
};

type LegacyBundle = {
  managerId: string | null;
  managerName: string | null;
  dealerRmId: string | null;
  dealerRmName: string | null;
  dealerRopId: string | null;
  dealerRopName: string | null;
  teamRopId: string | null;
  teamRopName: string | null;
};

export function cityScopeKey(city?: string | null, address?: string | null): string | null {
  const name = normalizeTerritoryCityName(city ?? null, address ?? null);
  if (!name || name === "Без города") return null;
  return name.toLowerCase();
}

export function dealerIdToClientCode(dealerId: string): string {
  return dealerId.replace(/^client-/i, "").toUpperCase();
}

export function clientCodeToDealerId(clientCode: string): string {
  return `client-${clientCode.trim().toLowerCase()}`;
}

function resolved(
  userId: string | null | undefined,
  userName: string | null | undefined,
  source: ResolveSource,
  sourceLevel: ResolveLevel,
): ResolvedResponsible {
  if (!userId) return { ...EMPTY };
  return {
    userId: String(userId),
    userName: userName?.trim() ? String(userName) : null,
    source,
    sourceLevel,
  };
}

async function fetchUserNames(pool: PoolLike, ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const r = await pool.query<{ id: string; full_name: string | null }>(
    `SELECT id::text AS id, full_name FROM users WHERE id = ANY($1::uuid[])`,
    [unique],
  );
  const map = new Map<string, string>();
  for (const row of r.rows) {
    const name = row.full_name?.trim();
    if (name) map.set(String(row.id), name);
  }
  return map;
}

async function loadTradePoint(pool: PoolLike, tpId: string): Promise<TradePointRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT tp_id, dealer_id, name, city, address, regional_manager_id, regional_manager_name, rop_id, rop_name
     FROM trade_point_overrides WHERE tp_id = $1 LIMIT 1`,
    [tpId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    tp_id: String(row.tp_id),
    dealer_id: row.dealer_id != null ? String(row.dealer_id) : null,
    name: row.name != null ? String(row.name) : null,
    city: row.city != null ? String(row.city) : null,
    address: row.address != null ? String(row.address) : null,
    regional_manager_id: row.regional_manager_id != null ? String(row.regional_manager_id) : null,
    regional_manager_name: row.regional_manager_name != null ? String(row.regional_manager_name) : null,
    rop_id: row.rop_id != null ? String(row.rop_id) : null,
    rop_name: row.rop_name != null ? String(row.rop_name) : null,
  };
}

async function loadAssignments(
  pool: PoolLike,
  args: { tpId: string; dealerId: string | null; cityKey: string | null },
): Promise<AssignmentRow[]> {
  const r = await pool.query<AssignmentRow>(
    `SELECT scope_kind, scope_key, responsible_role, user_id::text AS user_id, user_name
     FROM responsibility_assignments
     WHERE (scope_kind = 'trade_point' AND scope_key = $1)
        OR ($2::text IS NOT NULL AND scope_kind = 'client' AND scope_key = $2)
        OR ($3::text IS NOT NULL AND scope_kind = 'city' AND scope_key = $3)`,
    [args.tpId, args.dealerId, args.cityKey],
  );
  return r.rows;
}

async function loadLegacyBundle(pool: PoolLike, tp: TradePointRow): Promise<LegacyBundle> {
  const dealerId = tp.dealer_id;
  const clientCode = dealerId ? dealerIdToClientCode(dealerId) : null;

  const r = await pool.query<{
    manager_id: string | null;
    manager_name: string | null;
    dealer_rm_id: string | null;
    dealer_rm_name: string | null;
    dealer_rop_id: string | null;
    dealer_rop_name: string | null;
    team_rop_id: string | null;
    team_rop_name: string | null;
  }>(
    `SELECT
       ca.responsible_user_id::text AS manager_id,
       um.full_name AS manager_name,
       d.regional_manager_id::text AS dealer_rm_id,
       d.regional_manager_name AS dealer_rm_name,
       d.rop_id::text AS dealer_rop_id,
       d.rop_name AS dealer_rop_name,
       t.rop_user_id::text AS team_rop_id,
       ut.full_name AS team_rop_name
     FROM (SELECT 1) AS _one
     LEFT JOIN dealer_overrides d ON d.dealer_id = $1
     LEFT JOIN client_assignments ca ON ca.client_code = $2
     LEFT JOIN users um ON um.id = ca.responsible_user_id
     LEFT JOIN teams t ON t.id = ca.team_id
     LEFT JOIN users ut ON ut.id = t.rop_user_id`,
    [dealerId, clientCode],
  );

  const row = r.rows[0];
  return {
    managerId: row?.manager_id ?? null,
    managerName: row?.manager_name ?? null,
    dealerRmId: row?.dealer_rm_id ?? null,
    dealerRmName: row?.dealer_rm_name ?? null,
    dealerRopId: row?.dealer_rop_id ?? null,
    dealerRopName: row?.dealer_rop_name ?? null,
    teamRopId: row?.team_rop_id ?? null,
    teamRopName: row?.team_rop_name ?? null,
  };
}

function pickAssignment(
  role: ResponsibleRole,
  rows: AssignmentRow[],
  ctx: { tpId: string; dealerId: string | null; cityKey: string | null },
): ResolvedResponsible | null {
  const chain: Array<{ kind: ScopeKind; key: string | null; level: ResolveLevel }> = [
    { kind: "trade_point", key: ctx.tpId, level: "trade_point" },
    { kind: "client", key: ctx.dealerId, level: "client" },
    { kind: "city", key: ctx.cityKey, level: "city" },
  ];
  for (const step of chain) {
    if (!step.key) continue;
    const row = rows.find(
      (a) => a.responsible_role === role && a.scope_kind === step.kind && a.scope_key === step.key,
    );
    if (row?.user_id) {
      return resolved(row.user_id, row.user_name, "assignment", step.level);
    }
  }
  return null;
}

function resolveLegacyManager(tp: TradePointRow, legacy: LegacyBundle): ResolvedResponsible {
  void tp;
  return resolved(legacy.managerId, legacy.managerName, "legacy", "client");
}

function resolveLegacyRegionalManager(tp: TradePointRow, legacy: LegacyBundle): ResolvedResponsible {
  if (tp.regional_manager_id) {
    return resolved(tp.regional_manager_id, tp.regional_manager_name, "legacy", "trade_point");
  }
  return resolved(legacy.dealerRmId, legacy.dealerRmName, "legacy", "client");
}

function resolveLegacyRop(tp: TradePointRow, legacy: LegacyBundle): ResolvedResponsible {
  if (tp.rop_id) {
    return resolved(tp.rop_id, tp.rop_name, "legacy", "trade_point");
  }
  if (legacy.dealerRopId) {
    return resolved(legacy.dealerRopId, legacy.dealerRopName, "legacy", "client");
  }
  return resolved(legacy.teamRopId, legacy.teamRopName, "legacy", "team");
}

async function fillMissingNames(
  pool: PoolLike,
  items: ResolvedResponsible[],
): Promise<void> {
  const needIds = items
    .filter((i) => i.userId && !i.userName)
    .map((i) => i.userId as string);
  if (needIds.length === 0) return;
  const names = await fetchUserNames(pool, needIds);
  for (const item of items) {
    if (item.userId && !item.userName) {
      item.userName = names.get(item.userId) ?? null;
    }
  }
}

function resolveRole(
  role: ResponsibleRole,
  assignments: AssignmentRow[],
  ctx: { tpId: string; dealerId: string | null; cityKey: string | null },
  tp: TradePointRow,
  legacy: LegacyBundle,
): ResolvedResponsible {
  const fromAssignment = pickAssignment(role, assignments, ctx);
  if (fromAssignment) return fromAssignment;

  if (role === "manager") return resolveLegacyManager(tp, legacy);
  if (role === "regional_manager") return resolveLegacyRegionalManager(tp, legacy);
  return resolveLegacyRop(tp, legacy);
}

export async function resolveResponsiblesForTradePoint(
  pool: PoolLike,
  tpId: string,
): Promise<ResolvedResponsibles> {
  const tp = await loadTradePoint(pool, tpId);
  if (!tp) {
    return { manager: { ...EMPTY }, regional_manager: { ...EMPTY }, rop: { ...EMPTY } };
  }

  const cityKey = cityScopeKey(tp.city, tp.address);
  const [assignments, legacy] = await Promise.all([
    loadAssignments(pool, { tpId, dealerId: tp.dealer_id, cityKey }),
    loadLegacyBundle(pool, tp),
  ]);

  const manager = resolveRole("manager", assignments, { tpId, dealerId: tp.dealer_id, cityKey }, tp, legacy);
  const regional_manager = resolveRole(
    "regional_manager",
    assignments,
    { tpId, dealerId: tp.dealer_id, cityKey },
    tp,
    legacy,
  );
  const rop = resolveRole("rop", assignments, { tpId, dealerId: tp.dealer_id, cityKey }, tp, legacy);

  await fillMissingNames(pool, [manager, regional_manager, rop]);

  return { manager, regional_manager, rop };
}

function computeSharedByRole(
  tradePoints: Array<{ resolved: ResolvedResponsibles }>,
): { manager?: boolean; regional_manager?: boolean; rop?: boolean } {
  const sharedByRole: { manager?: boolean; regional_manager?: boolean; rop?: boolean } = {};
  for (const role of ROLES) {
    const ids = new Set(
      tradePoints.map((tp) => tp.resolved[role].userId).filter((id): id is string => Boolean(id)),
    );
    if (ids.size >= 2) sharedByRole[role] = true;
  }
  return sharedByRole;
}

export async function resolveClientResponsibility(
  pool: PoolLike,
  dealerId: string,
): Promise<{
  tradePoints: Array<{ tpId: string; name: string | null; city: string | null; resolved: ResolvedResponsibles }>;
  sharedByRole: { manager?: boolean; regional_manager?: boolean; rop?: boolean };
}> {
  const r = await pool.query<{ tp_id: string; name: string | null; city: string | null }>(
    `SELECT tp_id, name, city FROM trade_point_overrides WHERE dealer_id = $1 ORDER BY name ASC NULLS LAST, tp_id ASC`,
    [dealerId],
  );

  const tradePoints: Array<{
    tpId: string;
    name: string | null;
    city: string | null;
    resolved: ResolvedResponsibles;
  }> = [];

  for (const row of r.rows) {
    const tpId = String(row.tp_id);
    const resolved = await resolveResponsiblesForTradePoint(pool, tpId);
    tradePoints.push({
      tpId,
      name: row.name != null ? String(row.name) : null,
      city: row.city != null ? String(row.city) : null,
      resolved,
    });
  }

  return { tradePoints, sharedByRole: computeSharedByRole(tradePoints) };
}
