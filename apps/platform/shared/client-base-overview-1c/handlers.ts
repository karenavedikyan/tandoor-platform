/**
 * Client-base overview cockpit backed by mv_clients_1c / mv_stores_1c (admin-only).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import { resolveCurrentUser, sendJson, vercelHeaders } from "../admin/admin-auth.js";
import { loadOneCShowroomContext, type OneCShowroomContext } from "../one-c-showroom-context.js";

export type ClientBase1cStatus = "active" | "potential" | "attention";

export type Holding1cRow = {
  holding_id_1c: string;
  holding_name: string;
  holding_inn: string | null;
  holding_city: string | null;
  holding_region: string | null;
  stores_count: number;
  legals_count: number;
  responsible_managers: string[];
  regional_managers: string[];
  distribution_filled_count: number;
  distribution_total_targets: number;
  distribution_percent: number;
  orders_last_90d_count: number;
  orders_last_90d_amount: number;
  last_order_at: string | null;
  last_distribution_updated_at: string | null;
};

export type Store1cRow = {
  store_id_1c: string;
  store_name: string;
  store_address: string | null;
  holding_id_1c: string;
  holding_name: string | null;
  legal_id_1c: string;
  legal_name: string | null;
  legal_inn: string | null;
  legal_city: string | null;
  responsible_manager_name: string | null;
  regional_manager_name: string | null;
  store_manager_name: string | null;
  distribution_percent: number;
  orders_last_90d_count: number;
  last_order_at: string | null;
  last_distribution_updated_at: string | null;
};

const HOLDING_SELECT = `
  holding_id_1c::text,
  holding_name,
  holding_inn,
  holding_city,
  holding_region,
  stores_count,
  legals_count,
  responsible_managers,
  regional_managers,
  distribution_filled_count,
  distribution_total_targets,
  distribution_percent,
  orders_last_90d_count,
  orders_last_90d_amount,
  last_order_at,
  last_distribution_updated_at
`;

const STORE_SELECT = `
  store_id_1c::text,
  store_name,
  store_address,
  holding_id_1c::text,
  holding_name,
  legal_id_1c::text,
  legal_name,
  legal_inn,
  legal_city,
  responsible_manager_name,
  regional_manager_name,
  store_manager_name,
  distribution_percent,
  orders_last_90d_count,
  last_order_at,
  last_distribution_updated_at
`;

function queryStringParam(req: VercelRequest, key: string): string {
  const raw = req.query[key];
  return Array.isArray(raw) ? String(raw[0] ?? "").trim() : String(raw ?? "").trim();
}

function hasResponsibleManagers(names: string[]): boolean {
  return names.some((n) => n.trim().length > 0);
}

export function classifyHolding1cStatus(row: Holding1cRow): ClientBase1cStatus {
  if (row.orders_last_90d_count > 0) return "active";
  const hasManagers = hasResponsibleManagers(row.responsible_managers);
  if (row.last_order_at) {
    const ageMs = Date.now() - Date.parse(row.last_order_at);
    if (Number.isFinite(ageMs) && ageMs > 60 * 24 * 60 * 60 * 1000) return "attention";
  }
  if (!hasManagers) return "attention";
  return "potential";
}

function mapHoldingRow(row: Record<string, unknown>): Holding1cRow {
  return {
    holding_id_1c: String(row.holding_id_1c),
    holding_name: String(row.holding_name ?? ""),
    holding_inn: row.holding_inn != null ? String(row.holding_inn) : null,
    holding_city: row.holding_city != null ? String(row.holding_city) : null,
    holding_region: row.holding_region != null ? String(row.holding_region) : null,
    stores_count: Number(row.stores_count ?? 0),
    legals_count: Number(row.legals_count ?? 0),
    responsible_managers: Array.isArray(row.responsible_managers)
      ? row.responsible_managers.map(String)
      : [],
    regional_managers: Array.isArray(row.regional_managers)
      ? row.regional_managers.map(String)
      : [],
    distribution_filled_count: Number(row.distribution_filled_count ?? 0),
    distribution_total_targets: Number(row.distribution_total_targets ?? 0),
    distribution_percent: Number(row.distribution_percent ?? 0),
    orders_last_90d_count: Number(row.orders_last_90d_count ?? 0),
    orders_last_90d_amount: Number(row.orders_last_90d_amount ?? 0),
    last_order_at: row.last_order_at != null ? String(row.last_order_at) : null,
    last_distribution_updated_at:
      row.last_distribution_updated_at != null ? String(row.last_distribution_updated_at) : null,
  };
}

function mapStoreRow(row: Record<string, unknown>): Store1cRow {
  return {
    store_id_1c: String(row.store_id_1c),
    store_name: String(row.store_name ?? ""),
    store_address: row.store_address != null ? String(row.store_address) : null,
    holding_id_1c: String(row.holding_id_1c),
    holding_name: row.holding_name != null ? String(row.holding_name) : null,
    legal_id_1c: String(row.legal_id_1c),
    legal_name: row.legal_name != null ? String(row.legal_name) : null,
    legal_inn: row.legal_inn != null ? String(row.legal_inn) : null,
    legal_city: row.legal_city != null ? String(row.legal_city) : null,
    responsible_manager_name:
      row.responsible_manager_name != null ? String(row.responsible_manager_name) : null,
    regional_manager_name:
      row.regional_manager_name != null ? String(row.regional_manager_name) : null,
    store_manager_name: row.store_manager_name != null ? String(row.store_manager_name) : null,
    distribution_percent: Number(row.distribution_percent ?? 0),
    orders_last_90d_count: Number(row.orders_last_90d_count ?? 0),
    last_order_at: row.last_order_at != null ? String(row.last_order_at) : null,
    last_distribution_updated_at:
      row.last_distribution_updated_at != null ? String(row.last_distribution_updated_at) : null,
  };
}

async function loadHoldings(pool: PoolLike): Promise<Holding1cRow[]> {
  const res = await pool.query<Record<string, unknown>>(
    `SELECT ${HOLDING_SELECT} FROM mv_clients_1c ORDER BY holding_name ASC`,
  );
  return res.rows.map(mapHoldingRow);
}

async function loadStores(pool: PoolLike): Promise<Store1cRow[]> {
  const res = await pool.query<Record<string, unknown>>(
    `SELECT ${STORE_SELECT} FROM mv_stores_1c ORDER BY store_name ASC`,
  );
  return res.rows.map(mapStoreRow);
}

function managerNamesForUser(ctx: OneCShowroomContext, userId: string): string[] {
  return ctx.matchedResponsibleByUserId.get(userId) ?? [];
}

function holdingMatchesManagerNames(holding: Holding1cRow, names: string[]): boolean {
  if (names.length === 0) return false;
  const set = new Set(names);
  return holding.responsible_managers.some((n) => set.has(n.trim()));
}

function storeMatchesManagerNames(store: Store1cRow, names: string[]): boolean {
  if (names.length === 0) return false;
  const n = store.responsible_manager_name?.trim();
  return Boolean(n && names.includes(n));
}

function filterHoldingsByScope(
  holdings: Holding1cRow[],
  ctx: OneCShowroomContext,
  teamId: string | null,
  managerUserId: string | null,
): Holding1cRow[] {
  if (managerUserId) {
    const names = managerNamesForUser(ctx, managerUserId);
    return holdings.filter((h) => holdingMatchesManagerNames(h, names));
  }
  if (teamId) {
    const managerIds = Array.from(ctx.usersById.values())
      .filter((u) => u.team_id === teamId && u.role_in_team === "manager")
      .map((u) => u.id);
    const allNames = new Set<string>();
    for (const id of managerIds) {
      for (const n of managerNamesForUser(ctx, id)) allNames.add(n);
    }
    return holdings.filter((h) => holdingMatchesManagerNames(h, Array.from(allNames)));
  }
  return holdings;
}

function filterStoresByHoldings(stores: Store1cRow[], holdings: Holding1cRow[]): Store1cRow[] {
  const ids = new Set(holdings.map((h) => h.holding_id_1c));
  return stores.filter((s) => ids.has(s.holding_id_1c));
}

function primaryManagerForHolding(
  holding: Holding1cRow,
  ctx: OneCShowroomContext,
): { userId: string; fullName: string } {
  for (const name of holding.responsible_managers) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const userId = ctx.userIdByResponsibleName.get(trimmed);
    if (userId) {
      const user = ctx.usersById.get(userId);
      return { userId, fullName: user?.full_name ?? trimmed };
    }
  }
  return { userId: "", fullName: holding.responsible_managers[0]?.trim() || "—" };
}

function weightedDistributionPct(holdings: Holding1cRow[]): number {
  let weighted = 0;
  let weight = 0;
  for (const h of holdings) {
    if (h.stores_count <= 0) continue;
    weighted += h.distribution_percent * h.stores_count;
    weight += h.stores_count;
  }
  return weight > 0 ? Math.round(weighted / weight) : 0;
}

function buildRopGroups(
  holdings: Holding1cRow[],
  stores: Store1cRow[],
  ctx: OneCShowroomContext,
) {
  const statusByHolding = new Map(holdings.map((h) => [h.holding_id_1c, classifyHolding1cStatus(h)]));

  const holdingsForManager = (managerUserId: string): Holding1cRow[] => {
    const names = managerNamesForUser(ctx, managerUserId);
    return holdings.filter((h) => holdingMatchesManagerNames(h, names));
  };

  const storesForManager = (managerUserId: string): Store1cRow[] => {
    const names = managerNamesForUser(ctx, managerUserId);
    return stores.filter((s) => storeMatchesManagerNames(s, names));
  };

  const groups = ctx.teams.map((team) => {
    const rop = team.rop_user_id ? ctx.usersById.get(team.rop_user_id) : null;
    const managers = Array.from(ctx.usersById.values()).filter(
      (u) => u.team_id === team.id && u.role_in_team === "manager",
    );

    const managerRows = managers.map((m) => {
      const mHoldings = holdingsForManager(m.id);
      const mStores = storesForManager(m.id);
      const active = mHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "active").length;
      const potential = mHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "potential").length;
      const attention = mHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "attention").length;
      return {
        userId: m.id,
        fullName: m.full_name,
        active,
        tradePoints: mStores.length,
        segment: null as string | null,
        potential,
        attention,
      };
    });

    const teamHoldingIds = new Set<string>();
    for (const m of managers) {
      for (const h of holdingsForManager(m.id)) teamHoldingIds.add(h.holding_id_1c);
    }
    const teamHoldings = holdings.filter((h) => teamHoldingIds.has(h.holding_id_1c));
    const teamStores = stores.filter((s) => teamHoldingIds.has(s.holding_id_1c));

    return {
      ropUserId: team.rop_user_id,
      ropFullName: rop?.full_name ?? "Без РОП",
      teamId: team.id,
      teamName: team.name,
      clients: teamHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "active").length,
      tradePoints: teamStores.length,
      potential: teamHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "potential").length,
      attention: teamHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "attention").length,
      managerCount: managerRows.length,
      managersWithEmptyBase: managerRows.filter((m) => m.active === 0).length,
      managers: managerRows,
    };
  });

  const unassignedManagers = Array.from(ctx.usersById.values()).filter(
    (u) => u.role_in_team === "manager" && !u.team_id,
  );
  if (unassignedManagers.length > 0) {
    const managerRows = unassignedManagers.map((m) => {
      const mHoldings = holdingsForManager(m.id);
      const mStores = storesForManager(m.id);
      return {
        userId: m.id,
        fullName: m.full_name,
        active: mHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "active").length,
        tradePoints: mStores.length,
        segment: null as string | null,
        potential: mHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "potential").length,
        attention: mHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "attention").length,
      };
    });
    const ids = new Set<string>();
    for (const m of unassignedManagers) {
      for (const h of holdingsForManager(m.id)) ids.add(h.holding_id_1c);
    }
    const teamHoldings = holdings.filter((h) => ids.has(h.holding_id_1c));
    const teamStores = stores.filter((s) => ids.has(s.holding_id_1c));
    groups.push({
      ropUserId: null,
      ropFullName: "Без РОП",
      teamId: null,
      teamName: "Без команды",
      clients: teamHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "active").length,
      tradePoints: teamStores.length,
      potential: teamHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "potential").length,
      attention: teamHoldings.filter((h) => statusByHolding.get(h.holding_id_1c) === "attention").length,
      managerCount: managerRows.length,
      managersWithEmptyBase: managerRows.filter((m) => m.active === 0).length,
      managers: managerRows,
    });
  }

  return groups.sort((a, b) => b.clients - a.clients);
}

export async function buildClientBaseOverview1c(
  pool: PoolLike,
  teamId: string | null,
  managerUserId: string | null,
) {
  const [holdingsAll, storesAll, ctx] = await Promise.all([
    loadHoldings(pool),
    loadStores(pool),
    loadOneCShowroomContext(pool),
  ]);

  const holdings = filterHoldingsByScope(holdingsAll, ctx, teamId, managerUserId);
  const stores = filterStoresByHoldings(storesAll, holdings);

  const activeClients = holdings.filter((h) => h.orders_last_90d_count > 0);
  const potentialClients = holdings.filter(
    (h) => h.orders_last_90d_count === 0 && hasResponsibleManagers(h.responsible_managers),
  );
  const attentionClients = holdings.filter((h) => {
    if (h.orders_last_90d_count > 0) return false;
    const hasManagers = hasResponsibleManagers(h.responsible_managers);
    if (!hasManagers) return true;
    if (h.last_order_at) {
      const ageMs = Date.now() - Date.parse(h.last_order_at);
      return Number.isFinite(ageMs) && ageMs > 60 * 24 * 60 * 60 * 1000;
    }
    return false;
  });

  const cityMap = new Map<string, { city: string | null; clients: number; tradePoints: number }>();
  for (const h of holdings) {
    const key = h.holding_city?.trim() || "__without__";
    const cur = cityMap.get(key) ?? {
      city: key === "__without__" ? null : h.holding_city,
      clients: 0,
      tradePoints: 0,
    };
    cur.clients += 1;
    cur.tradePoints += h.stores_count;
    cityMap.set(key, cur);
  }
  const cities = Array.from(cityMap.values())
    .filter((c) => c.city)
    .sort((a, b) => b.clients - a.clients)
    .slice(0, 15);
  const withoutCity = cityMap.get("__without__") ?? { clients: 0, tradePoints: 0 };

  const totalStores = holdings.reduce((sum, h) => sum + h.stores_count, 0);
  const avgTpPerClient =
    holdings.length > 0 ? Number((totalStores / holdings.length).toFixed(2)) : 0;

  return {
    success: true as const,
    generatedAt: new Date().toISOString(),
    structure: {
      activeClients: activeClients.length,
      tradePoints: totalStores,
      potentialClients: potentialClients.length,
      attentionClients: attentionClients.length,
      averageDistributionPct: weightedDistributionPct(holdings),
      avgTpPerClient,
      managersWithClientsWithoutTp: 0,
      citiesWithClientsWithoutTp: 0,
    },
    topActiveClients: [...holdings]
      .sort((a, b) => b.orders_last_90d_amount - a.orders_last_90d_amount)
      .slice(0, 10)
      .map((h) => {
        const mgr = primaryManagerForHolding(h, ctx);
        return {
          clientId: h.holding_id_1c,
          fullName: h.holding_name,
          tradePointsCount: h.stores_count,
          managerUserId: mgr.userId,
          managerFullName: mgr.fullName,
          city: h.holding_city?.trim() || "",
        };
      }),
    cities,
    withoutCity,
    ropGroups: buildRopGroups(holdings, stores, ctx),
  };
}

async function loadHoldingPhones(
  pool: PoolLike,
  holdingIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (holdingIds.length === 0) return out;
  const res = await pool.query<{ holding_id_1c: string; phone: string | null }>(
    `SELECT COALESCE(l.parent_1c, l.id_1c)::text AS holding_id_1c,
            MAX(NULLIF(BTRIM(l.phone), '')) AS phone
     FROM exchange_legals_raw l
     WHERE COALESCE(l.parent_1c, l.id_1c) = ANY($1::uuid[])
     GROUP BY COALESCE(l.parent_1c, l.id_1c)`,
    [holdingIds],
  );
  for (const row of res.rows) out.set(row.holding_id_1c, row.phone);
  return out;
}

export async function buildClientBaseManagerDetail1c(pool: PoolLike, managerUserId: string) {
  const ctx = await loadOneCShowroomContext(pool);
  const manager = ctx.usersById.get(managerUserId);
  if (!manager || manager.role_in_team !== "manager") {
    return null;
  }

  const team = ctx.teams.find((t) => t.id === manager.team_id);
  const rop = team?.rop_user_id ? ctx.usersById.get(team.rop_user_id) : null;
  const names = managerNamesForUser(ctx, managerUserId);

  const [holdingsAll, storesAll] = await Promise.all([loadHoldings(pool), loadStores(pool)]);
  const holdings = holdingsAll.filter((h) => holdingMatchesManagerNames(h, names));
  const stores = storesAll.filter((s) => storeMatchesManagerNames(s, names));
  const phones = await loadHoldingPhones(
    pool,
    holdings.map((h) => h.holding_id_1c),
  );

  const storesByHolding = new Map<string, string[]>();
  for (const s of stores) {
    const arr = storesByHolding.get(s.holding_id_1c) ?? [];
    arr.push(s.store_id_1c);
    storesByHolding.set(s.holding_id_1c, arr);
  }

  return {
    success: true as const,
    manager: {
      userId: manager.id,
      fullName: manager.full_name,
      teamId: manager.team_id,
      ropFullName: rop?.full_name ?? "—",
    },
    clients: holdings.map((h) => ({
      id: h.holding_id_1c,
      fullName: h.holding_name,
      inn: h.holding_inn,
      phone: phones.get(h.holding_id_1c) ?? null,
      legalEntity: true,
      city: h.holding_city,
      status: classifyHolding1cStatus(h),
      tradePointIds: storesByHolding.get(h.holding_id_1c) ?? [],
      tradePointsCount: h.stores_count,
      updatedAt: h.last_distribution_updated_at ?? h.last_order_at,
      dealerProfileId: null,
    })),
    tradePoints: stores.map((s) => ({
      id: s.store_id_1c,
      name: s.store_name,
      address: s.store_address ?? "",
      city: s.legal_city?.trim() || "",
      clientId: s.holding_id_1c,
      hasPhoto: false,
      hasStorefront: false,
      updatedAt: s.last_distribution_updated_at ?? s.last_order_at,
    })),
  };
}

function managerHasRop(ctx: OneCShowroomContext, holding: Holding1cRow): boolean {
  for (const name of holding.responsible_managers) {
    const userId = ctx.userIdByResponsibleName.get(name.trim());
    if (!userId) continue;
    const user = ctx.usersById.get(userId);
    if (user?.team_id) {
      const team = ctx.teams.find((t) => t.id === user.team_id);
      if (team?.rop_user_id) return true;
    }
  }
  return false;
}

function managerHasRegional(holding: Holding1cRow): boolean {
  return holding.regional_managers.some((n) => n.trim().length > 0);
}

export async function buildClientBaseClientsList1c(
  pool: PoolLike,
  teamId: string | null,
  managerUserId: string | null,
) {
  const ctx = await loadOneCShowroomContext(pool);
  const [holdingsAll, storesAll] = await Promise.all([loadHoldings(pool), loadStores(pool)]);
  const holdings = filterHoldingsByScope(holdingsAll, ctx, teamId, managerUserId);
  const stores = filterStoresByHoldings(storesAll, holdings);
  const phones = await loadHoldingPhones(
    pool,
    holdings.map((h) => h.holding_id_1c),
  );

  const storesByHolding = new Map<string, string[]>();
  for (const s of stores) {
    const arr = storesByHolding.get(s.holding_id_1c) ?? [];
    arr.push(s.store_id_1c);
    storesByHolding.set(s.holding_id_1c, arr);
  }

  const clients = holdings.map((h) => {
    const mgr = primaryManagerForHolding(h, ctx);
    return {
      id: h.holding_id_1c,
      fullName: h.holding_name,
      inn: h.holding_inn,
      phone: phones.get(h.holding_id_1c) ?? null,
      legalEntity: true,
      city: h.holding_city,
      status: classifyHolding1cStatus(h),
      managerUserId: mgr.userId || null,
      managerFullName: mgr.fullName || null,
      tradePointIds: storesByHolding.get(h.holding_id_1c) ?? [],
      tradePointsCount: h.stores_count,
      updatedAt: h.last_distribution_updated_at ?? h.last_order_at,
      inCatalog: true,
      hasManager: hasResponsibleManagers(h.responsible_managers),
      hasRegional: managerHasRegional(h),
      hasRop: managerHasRop(ctx, h),
    };
  });

  const activeCount = clients.filter((c) => c.status === "active").length;

  return {
    success: true as const,
    generatedAt: new Date().toISOString(),
    clients,
    tradePoints: stores.map((s) => ({
      id: s.store_id_1c,
      name: s.store_name,
      address: s.store_address ?? "",
      city: s.legal_city?.trim() || "",
      clientId: s.holding_id_1c,
      hasPhoto: false,
      hasStorefront: false,
      updatedAt: s.last_distribution_updated_at ?? s.last_order_at,
    })),
    meta: {
      catalogTotal: holdings.length,
      activeCount,
      tradePointsCount: stores.length,
    },
  };
}

async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<{ id: string; role: string } | null> {
  const me = await resolveCurrentUser(pool, vercelHeaders(req));
  if (!me) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
    return null;
  }
  if (me.role !== "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
    return null;
  }
  return me;
}

export async function handleClientBaseOverview1c(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }
  if (!(await requireAdmin(req, res, pool))) return;
  const teamId = queryStringParam(req, "teamId") || null;
  const managerUserId = queryStringParam(req, "managerUserId") || null;
  const payload = await buildClientBaseOverview1c(pool, teamId, managerUserId);
  sendJson(res, 200, payload);
}

export async function handleClientBaseManagerDetail1c(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }
  if (!(await requireAdmin(req, res, pool))) return;
  const managerUserId = queryStringParam(req, "managerUserId");
  if (!managerUserId) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "Укажите managerUserId." });
    return;
  }
  const payload = await buildClientBaseManagerDetail1c(pool, managerUserId);
  if (!payload) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Менеджер не найден." });
    return;
  }
  sendJson(res, 200, payload);
}

export async function handleClientBaseClientsList1c(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }
  if (!(await requireAdmin(req, res, pool))) return;
  const teamId = queryStringParam(req, "teamId") || null;
  const managerUserId = queryStringParam(req, "managerUserId") || null;
  const payload = await buildClientBaseClientsList1c(pool, teamId, managerUserId);
  sendJson(res, 200, payload);
}
