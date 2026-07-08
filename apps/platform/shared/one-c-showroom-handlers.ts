/**
 * Read-only handlers for /1c/* showroom (LK hierarchy + 1C shadow tables).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../server/db/neon-client.js";
import { sendJson } from "./admin/admin-auth.js";
import {
  canEditDistributionForStore1c,
} from "./one-c-distribution-permissions.js";
import {
  fetchDistributionFillForStores,
  fetchHistory1cForStore,
  fetchStoreDistributionState,
  type OneCHistoryRowDto,
  type OneCMatrixRowDto,
  type OneCOverrideDto,
} from "./one-c-distribution-handlers.js";
import {
  buildHierarchy,
  countLegalsActive,
  countLegalsForRegionalNames,
  countLegalsForResponsibleNames,
  countManagersWithMatch,
  countRmsWithMatch,
  countStoresActive,
  legalMatchesActiveFilter,
  loadOneCShowroomContext,
  ropCountsFromTeamManagers,
  storeIdsForRegionalNames,
  storeIdsForResponsibleNames,
  teamContextForUser,
  type OneCShowroomContext,
} from "./one-c-showroom-context.js";

export { normalizeName, nameMatches } from "./one-c-name-matching.js";

export function canAccessOneCShowroom(role: string): boolean {
  return role === "admin" || role === "manager";
}

function parseLimitOffset(req: VercelRequest, defaultLimit = 100, maxLimit = 500) {
  const limitParam = Number(req.query.limit ?? defaultLimit);
  const offsetParam = Number(req.query.offset ?? 0);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), maxLimit) : defaultLimit;
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
  return { limit, offset };
}

function parseSearch(req: VercelRequest): string {
  return String(req.query.q ?? req.query.search ?? "").trim();
}

function parseUserId(req: VercelRequest): string {
  return String(req.query.user_id ?? req.query.userId ?? "").trim();
}

function parseOnlyActive(req: VercelRequest): boolean {
  const raw = req.query.onlyActive;
  const v = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "1");
  return v !== "0" && v.toLowerCase() !== "false";
}

function parseHasDistribution(req: VercelRequest): boolean {
  const raw = req.query.hasDistribution;
  const v = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
  return v === "1" || v.toLowerCase() === "true";
}

export type OneCOverviewV2 = {
  rops: number;
  rms: number;
  managers: number;
  storesActive: number;
  storesTotal: number;
  legalsActive: number;
  legalsTotal: number;
  last_imported_at: string | null;
};

export async function fetchOneCOverview(pool: PoolLike): Promise<OneCOverviewV2> {
  const ctx = await loadOneCShowroomContext(pool);
  return {
    rops: ctx.teams.length,
    rms: countRmsWithMatch(ctx),
    managers: countManagersWithMatch(ctx),
    storesActive: countStoresActive(ctx),
    storesTotal: ctx.storesTotal,
    legalsActive: countLegalsActive(ctx),
    legalsTotal: ctx.legalsTotal,
    last_imported_at: ctx.last_imported_at,
  };
}

export async function fetchOneCHierarchy(pool: PoolLike, q: string) {
  const ctx = await loadOneCShowroomContext(pool);
  return { items: buildHierarchy(ctx, q) };
}

export type OneCUserCard = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  teamName: string | null;
  ropName: string | null;
  rmNames: string[];
  storeCount: number;
  legalCount: number;
};

async function fetchUserCard(
  pool: PoolLike,
  userId: string,
  kind: "rop" | "rm" | "manager",
): Promise<OneCUserCard | null> {
  const ctx = await loadOneCShowroomContext(pool);
  const user = ctx.usersById.get(userId);
  if (!user) return null;

  const { team, rop, rms } = teamContextForUser(userId, ctx);
  let storeCount = 0;
  let legalCount = 0;

  if (kind === "manager") {
    const names = ctx.matchedResponsibleByUserId.get(userId) ?? [];
    storeCount = storeIdsForResponsibleNames(names, ctx).size;
    legalCount = countLegalsForResponsibleNames(names, ctx);
  } else if (kind === "rm") {
    const names = ctx.matchedRegionalByUserId.get(userId) ?? [];
    storeCount = storeIdsForRegionalNames(names, ctx).size;
    legalCount = countLegalsForRegionalNames(names, ctx);
  } else if (team) {
    const counts = ropCountsFromTeamManagers(team.id, ctx);
    storeCount = counts.storeCount;
    legalCount = counts.legalCount;
  }

  return {
    userId: user.id,
    fullName: user.full_name,
    phone: user.phone,
    email: user.email,
    teamName: team?.name ?? null,
    ropName: rop?.full_name ?? null,
    rmNames: rms.map((r) => r.full_name),
    storeCount,
    legalCount,
  };
}

export type OneCTeamMemberRow = {
  userId: string;
  fullName: string;
  phone: string | null;
  storeCount: number;
  legalCount: number;
};

export async function fetchOneCRop(pool: PoolLike, userId: string) {
  const ctx = await loadOneCShowroomContext(pool);
  const user = ctx.usersById.get(userId);
  if (!user) return null;
  const team = ctx.teams.find((t) => t.rop_user_id === userId);
  if (!team) return null;

  const card = await fetchUserCard(pool, userId, "rop");
  if (!card) return null;

  const rms: OneCTeamMemberRow[] = (ctx.membershipsByTeam.get(team.id) ?? [])
    .filter((m) => m.role_in_team === "regional_manager")
    .map((rm) => {
      const names = ctx.matchedRegionalByUserId.get(rm.id) ?? [];
      return {
        userId: rm.id,
        fullName: rm.full_name,
        phone: rm.phone,
        storeCount: storeIdsForRegionalNames(names, ctx).size,
        legalCount: countLegalsForRegionalNames(names, ctx),
      };
    });

  const managers: OneCTeamMemberRow[] = (ctx.membershipsByTeam.get(team.id) ?? [])
    .filter((m) => m.role_in_team === "manager")
    .map((mgr) => {
      const names = ctx.matchedResponsibleByUserId.get(mgr.id) ?? [];
      return {
        userId: mgr.id,
        fullName: mgr.full_name,
        phone: mgr.phone,
        storeCount: storeIdsForResponsibleNames(names, ctx).size,
        legalCount: countLegalsForResponsibleNames(names, ctx),
      };
    });

  return { user: card, rms, managers };
}

export async function fetchOneCRm(pool: PoolLike, userId: string, q: string, limit: number, offset: number) {
  const ctx = await loadOneCShowroomContext(pool);
  const user = ctx.usersById.get(userId);
  if (!user || user.role_in_team !== "regional_manager") return null;

  const card = await fetchUserCard(pool, userId, "rm");
  if (!card) return null;

  const team = ctx.teams.find((t) => t.id === user.team_id);
  const managers: OneCTeamMemberRow[] = (ctx.membershipsByTeam.get(user.team_id) ?? [])
    .filter((m) => m.role_in_team === "manager")
    .map((mgr) => {
      const names = ctx.matchedResponsibleByUserId.get(mgr.id) ?? [];
      return {
        userId: mgr.id,
        fullName: mgr.full_name,
        phone: mgr.phone,
        storeCount: storeIdsForResponsibleNames(names, ctx).size,
        legalCount: countLegalsForResponsibleNames(names, ctx),
      };
    });

  const names = ctx.matchedRegionalByUserId.get(userId) ?? [];
  const stores = await queryRmStores(pool, names, q, limit, offset, ctx);
  return { user: card, teamName: team?.name ?? null, ropName: card.ropName, managers, ...stores };
}

export async function fetchOneCManager(pool: PoolLike, userId: string, q: string, limit: number, offset: number) {
  const ctx = await loadOneCShowroomContext(pool);
  const user = ctx.usersById.get(userId);
  if (!user || user.role_in_team !== "manager") return null;

  const card = await fetchUserCard(pool, userId, "manager");
  if (!card) return null;

  const names = ctx.matchedResponsibleByUserId.get(userId) ?? [];
  const stores = await queryManagerStores(pool, names, q, limit, offset);
  return { user: card, ...stores };
}

export type OneCStoreListItem = {
  id_1c: string;
  address: string | null;
  manager_name: string | null;
  legal_name: string | null;
  legal_inn: string | null;
  legal_city: string | null;
  legal_parent_1c: string | null;
  legal_parent_name: string | null;
  legal_client_type: string | null;
  legal_regional_manager_name: string | null;
  legal_payment_form: string | null;
  status: string | null;
  distribution_filled: number;
  distribution_total: number;
};

const ONE_C_STORE_LIST_SELECT = `SELECT
       s.id_1c::text,
       s.address,
       s.manager_name,
       l.name AS legal_name,
       l.inn AS legal_inn,
       l.city AS legal_city,
       l.parent_1c::text AS legal_parent_1c,
       p.name AS legal_parent_name,
       l.client_type AS legal_client_type,
       l.regional_manager_name AS legal_regional_manager_name,
       l.payment_form AS legal_payment_form,
       s.status`;

const ONE_C_STORE_LIST_JOINS = `FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c`;

const ONE_C_STORE_LIST_SEARCH = `(
      $SEARCH::text IS NULL
      OR s.address ILIKE $SEARCH
      OR s.manager_name ILIKE $SEARCH
      OR l.name ILIKE $SEARCH
      OR l.legal_name ILIKE $SEARCH
      OR l.inn ILIKE $SEARCH
      OR p.name ILIKE $SEARCH
    )`;

type OneCStoreListRow = Omit<OneCStoreListItem, "distribution_filled" | "distribution_total">;

async function attachDistributionFill(
  pool: PoolLike,
  rows: OneCStoreListRow[],
): Promise<OneCStoreListItem[]> {
  const fillByStore = await fetchDistributionFillForStores(
    pool,
    rows.map((r) => r.id_1c),
  );
  return rows.map((r) => {
    const f = fillByStore.get(r.id_1c) ?? { filled: 0, total: 0 };
    return {
      ...r,
      distribution_filled: f.filled,
      distribution_total: f.total,
    };
  });
}

async function queryManagerStores(
  pool: PoolLike,
  matchedNames: string[],
  q: string,
  limit: number,
  offset: number,
) {
  if (matchedNames.length === 0) {
    return { total: 0, items: [] as OneCStoreListItem[] };
  }
  const pattern = q ? `%${q}%` : null;
  const where = `WHERE l.responsible_manager_name = ANY($1::text[])
    AND ${ONE_C_STORE_LIST_SEARCH.replaceAll("$SEARCH", "$2")}`;
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM exchange_legals_raw l
     JOIN exchange_stores_raw s ON s.legal_entity_1c::text = l.id_1c::text
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     ${where}`,
    [matchedNames, pattern],
  );
  const rows = await pool.query<OneCStoreListRow>(
    `${ONE_C_STORE_LIST_SELECT}
     FROM exchange_legals_raw l
     JOIN exchange_stores_raw s ON s.legal_entity_1c::text = l.id_1c::text
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     ${where}
     ORDER BY s.address ASC NULLS LAST
     LIMIT $3 OFFSET $4`,
    [matchedNames, pattern, limit, offset],
  );
  const items = await attachDistributionFill(pool, rows.rows);
  return { total: countRes.rows[0]?.n ?? 0, items };
}

async function queryRmStores(
  pool: PoolLike,
  matchedNames: string[],
  q: string,
  limit: number,
  offset: number,
  _ctx: OneCShowroomContext,
) {
  if (matchedNames.length === 0) {
    return { total: 0, items: [] as OneCStoreListItem[] };
  }
  const pattern = q ? `%${q}%` : null;
  const where = `WHERE l.regional_manager_name = ANY($1::text[])
    AND ${ONE_C_STORE_LIST_SEARCH.replaceAll("$SEARCH", "$2")}`;
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM exchange_legals_raw l
     JOIN exchange_stores_raw s ON s.legal_entity_1c::text = l.id_1c::text
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     ${where}`,
    [matchedNames, pattern],
  );
  const rows = await pool.query<OneCStoreListRow>(
    `${ONE_C_STORE_LIST_SELECT}
     FROM exchange_legals_raw l
     JOIN exchange_stores_raw s ON s.legal_entity_1c::text = l.id_1c::text
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     ${where}
     ORDER BY s.address ASC NULLS LAST
     LIMIT $3 OFFSET $4`,
    [matchedNames, pattern, limit, offset],
  );
  const items = await attachDistributionFill(pool, rows.rows);
  return { total: countRes.rows[0]?.n ?? 0, items };
}

export async function fetchOneCStores(
  pool: PoolLike,
  q: string,
  limit: number,
  offset: number,
  onlyActive: boolean,
) {
  const ctx = await loadOneCShowroomContext(pool);
  const pattern = q ? `%${q}%` : null;

  const activeClause = onlyActive
    ? `AND (
         l.responsible_manager_name = ANY($2::text[])
         OR l.regional_manager_name = ANY($3::text[])
       )`
    : "";

  const params: unknown[] = onlyActive
    ? [pattern, ctx.activeManagerMatchedNames, ctx.activeRmMatchedNames]
    : [pattern];

  const where = `WHERE (
    $1::text IS NULL
    OR s.address ILIKE $1
    OR s.manager_name ILIKE $1
    OR l.name ILIKE $1
    OR l.legal_name ILIKE $1
    OR l.inn ILIKE $1
    OR p.name ILIKE $1
  ) ${activeClause}`;

  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     ${where}`,
    params,
  );
  const limitIdx = onlyActive ? 4 : 2;
  const offsetIdx = onlyActive ? 5 : 3;
  const rows = await pool.query<OneCStoreListRow>(
    `${ONE_C_STORE_LIST_SELECT}
     ${ONE_C_STORE_LIST_JOINS}
     ${where}
     ORDER BY s.address ASC NULLS LAST
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset],
  );
  const items = await attachDistributionFill(pool, rows.rows);
  return { total: countRes.rows[0]?.n ?? 0, items };
}

export type OneCStoreDetail = {
  id_1c: string;
  address: string | null;
  name: string;
  status: string;
  imported_at: string;
  manager_1c: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  legal_entity_1c: string | null;
  legal_name: string | null;
  legal_legal_name: string | null;
  legal_inn: string | null;
  legal_kpp: string | null;
  legal_ogrn: string | null;
  legal_region: string | null;
  legal_city: string | null;
  legal_client_type: string | null;
  legal_payment_form: string | null;
  legal_phone: string | null;
  legal_email: string | null;
  legal_discount_code: string | null;
  legal_discount_percent: number | null;
  legal_regional_manager_name: string | null;
  legal_responsible_manager_name: string | null;
  legal_furniture_manager_name: string | null;
  legal_furniture_manager_phone: string | null;
  legal_ma_number: string | null;
  legal_plan_sum: number | null;
  legal_plan_retro_bonus: string | null;
  legal_parent_1c: string | null;
  legal_parent_name: string | null;
  legal_parent_inn: string | null;
  responsible_manager_user_id: string | null;
  regional_manager_user_id: string | null;
  rop_user_id: string | null;
  rop_name: string | null;
};

export type OneCStoreDetailWithDistribution = OneCStoreDetail & {
  matrix: OneCMatrixRowDto[];
  overrides: OneCOverrideDto[];
  history: OneCHistoryRowDto[];
  distributionFill: { filled: number; total: number };
  canEditDistribution: boolean;
};

export async function fetchOneCStore(pool: PoolLike, id1c: string): Promise<OneCStoreDetail | null> {
  const ctx = await loadOneCShowroomContext(pool);
  const res = await pool.query<Omit<OneCStoreDetail, "responsible_manager_user_id" | "regional_manager_user_id">>(
    `SELECT
       s.id_1c::text, s.address, s.name, s.status, s.imported_at,
       s.manager_1c::text, s.manager_name, s.manager_phone,
       s.legal_entity_1c::text,
       l.name AS legal_name,
       l.legal_name AS legal_legal_name,
       l.inn AS legal_inn,
       l.kpp AS legal_kpp,
       l.ogrn AS legal_ogrn,
       l.region AS legal_region,
       l.city AS legal_city,
       l.client_type AS legal_client_type,
       l.payment_form AS legal_payment_form,
       l.phone AS legal_phone,
       l.email AS legal_email,
       l.discount_code AS legal_discount_code,
       l.discount_percent AS legal_discount_percent,
       l.regional_manager_name AS legal_regional_manager_name,
       l.responsible_manager_name AS legal_responsible_manager_name,
       l.furniture_manager_name AS legal_furniture_manager_name,
       l.furniture_manager_phone AS legal_furniture_manager_phone,
       l.ma_number AS legal_ma_number,
       l.plan_sum AS legal_plan_sum,
       l.plan_retro_bonus AS legal_plan_retro_bonus,
       l.parent_1c::text AS legal_parent_1c,
       p.name AS legal_parent_name,
       p.inn AS legal_parent_inn
     FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     WHERE s.id_1c = $1
     LIMIT 1`,
    [id1c],
  );
  const row = res.rows[0];
  if (!row) return null;

  const responsible_manager_user_id = row.legal_responsible_manager_name
    ? (ctx.userIdByResponsibleName.get(row.legal_responsible_manager_name) ?? null)
    : null;
  const regional_manager_user_id = row.legal_regional_manager_name
    ? (ctx.userIdByRegionalName.get(row.legal_regional_manager_name) ?? null)
    : null;

  let rop_user_id: string | null = null;
  let rop_name: string | null = null;
  if (regional_manager_user_id) {
    const rmUser = ctx.usersById.get(regional_manager_user_id);
    if (rmUser?.team_id) {
      const team = ctx.teams.find((t) => t.id === rmUser.team_id);
      if (team?.rop_user_id) {
        rop_user_id = team.rop_user_id;
        rop_name = ctx.usersById.get(team.rop_user_id)?.full_name ?? null;
      }
    }
  }

  return { ...row, responsible_manager_user_id, regional_manager_user_id, rop_user_id, rop_name };
}

export async function fetchOneCStoreWithDistribution(
  pool: PoolLike,
  id1c: string,
  viewerUserId: string | null,
): Promise<OneCStoreDetailWithDistribution | null> {
  const store = await fetchOneCStore(pool, id1c);
  if (!store) return null;
  const [{ matrix, overrides, distributionFill }, historyRes] = await Promise.all([
    fetchStoreDistributionState(pool, id1c),
    fetchHistory1cForStore(pool, id1c, 20, 0),
  ]);
  const canEditDistribution = viewerUserId
    ? await canEditDistributionForStore1c(pool, viewerUserId, id1c)
    : false;
  return {
    ...store,
    matrix,
    overrides,
    history: historyRes.items,
    distributionFill,
    canEditDistribution,
  };
}

export type OneCLegalListItem = {
  id_1c: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  city: string | null;
  parent_1c: string | null;
  parent_name: string | null;
  client_type: string | null;
  payment_form: string | null;
  regional_manager_name: string | null;
  responsible_manager_name: string | null;
  plan_sum: number | null;
  stores_count: number;
  has_distribution: boolean;
};

export async function fetchOneCLegals(
  pool: PoolLike,
  q: string,
  limit: number,
  offset: number,
  onlyActive: boolean,
  hasDistribution = false,
) {
  const ctx = await loadOneCShowroomContext(pool);
  const pattern = q ? `%${q}%` : null;
  const activeClause = onlyActive
    ? `AND (
         l.responsible_manager_name = ANY($2::text[])
         OR l.regional_manager_name = ANY($3::text[])
       )`
    : "";
  const params: unknown[] = onlyActive
    ? [pattern, ctx.activeManagerMatchedNames, ctx.activeRmMatchedNames]
    : [pattern];
  const limitIdx = onlyActive ? 4 : 2;
  const offsetIdx = onlyActive ? 5 : 3;

  const distClause = hasDistribution
    ? `AND EXISTS (
         SELECT 1 FROM exchange_stores_raw s
         INNER JOIN showcase_matrix_1c m ON m.store_id_1c = s.id_1c AND m.actual_count > 0
         WHERE s.legal_entity_1c = l.id_1c
       )`
    : "";

  const where = `WHERE ($1::text IS NULL OR l.name ILIKE $1 OR l.legal_name ILIKE $1 OR l.inn ILIKE $1 OR p.name ILIKE $1) ${activeClause} ${distClause}`;

  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM exchange_legals_raw l
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     ${where}`,
    params,
  );
  const rows = await pool.query<Omit<OneCLegalListItem, "has_distribution">>(
    `SELECT l.id_1c::text, l.name, l.legal_name, l.inn, l.kpp, l.city,
            l.parent_1c::text, p.name AS parent_name,
            l.client_type, l.payment_form,
            l.regional_manager_name, l.responsible_manager_name, l.plan_sum,
            COUNT(s.id_1c)::int AS stores_count
     FROM exchange_legals_raw l
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     LEFT JOIN exchange_stores_raw s ON s.legal_entity_1c = l.id_1c
     ${where}
     GROUP BY l.id_1c, l.name, l.legal_name, l.inn, l.kpp, l.city,
              l.parent_1c, p.name, l.client_type, l.payment_form,
              l.regional_manager_name, l.responsible_manager_name, l.plan_sum
     ORDER BY l.name ASC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset],
  );
  const legalIds = rows.rows.map((r) => r.id_1c);
  const distFlags = new Map<string, boolean>();
  if (legalIds.length > 0) {
    const distRes = await pool.query<{ legal_entity_1c: string }>(
      `SELECT DISTINCT s.legal_entity_1c::text
       FROM exchange_stores_raw s
       INNER JOIN showcase_matrix_1c m ON m.store_id_1c = s.id_1c AND m.actual_count > 0
       WHERE s.legal_entity_1c = ANY($1::uuid[])`,
      [legalIds],
    );
    for (const r of distRes.rows) distFlags.set(r.legal_entity_1c, true);
  }
  const items: OneCLegalListItem[] = rows.rows.map((r) => ({
    ...r,
    has_distribution: distFlags.has(r.id_1c),
  }));
  return { total: countRes.rows[0]?.n ?? 0, items };
}

export type OneCLegalChild = {
  id_1c: string;
  name: string;
  inn: string | null;
};

export type OneCLegalDetail = {
  id_1c: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  ma_number: string | null;
  payment_form: string | null;
  region: string | null;
  city: string | null;
  client_type: string | null;
  phone: string | null;
  email: string | null;
  discount_code: string | null;
  discount_percent: number | null;
  regional_manager_name: string | null;
  responsible_manager_name: string | null;
  furniture_manager_name: string | null;
  furniture_manager_phone: string | null;
  parent_1c: string | null;
  parent_name: string | null;
  parent_inn: string | null;
  plan_retro_bonus: string | null;
  plan_sum: number | null;
  imported_at: string;
  responsible_manager_user_id: string | null;
  regional_manager_user_id: string | null;
  rop_user_id: string | null;
  rop_name: string | null;
};

export type OneCLegalSibling = {
  id_1c: string;
  name: string;
  inn: string | null;
};

export async function fetchOneCLegal(pool: PoolLike, id1c: string) {
  const ctx = await loadOneCShowroomContext(pool);
  const res = await pool.query<OneCLegalDetail>(
    `SELECT
       l.id_1c::text, l.name, l.legal_name, l.inn, l.kpp, l.ogrn, l.ma_number, l.payment_form,
       l.region, l.city, l.client_type, l.phone, l.email,
       l.discount_code, l.discount_percent,
       l.regional_manager_name, l.responsible_manager_name,
       l.furniture_manager_name, l.furniture_manager_phone,
       l.parent_1c::text, p.name AS parent_name, p.inn AS parent_inn,
       l.plan_retro_bonus, l.plan_sum, l.imported_at
     FROM exchange_legals_raw l
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     WHERE l.id_1c = $1
     LIMIT 1`,
    [id1c],
  );
  const legal = res.rows[0];
  if (!legal) return null;

  legal.responsible_manager_user_id = legal.responsible_manager_name
    ? (ctx.userIdByResponsibleName.get(legal.responsible_manager_name) ?? null)
    : null;
  legal.regional_manager_user_id = legal.regional_manager_name
    ? (ctx.userIdByRegionalName.get(legal.regional_manager_name) ?? null)
    : null;

  let rop_user_id: string | null = null;
  let rop_name: string | null = null;
  if (legal.regional_manager_user_id) {
    const rmUser = ctx.usersById.get(legal.regional_manager_user_id);
    if (rmUser?.team_id) {
      const team = ctx.teams.find((t) => t.id === rmUser.team_id);
      if (team?.rop_user_id) {
        rop_user_id = team.rop_user_id;
        rop_name = ctx.usersById.get(team.rop_user_id)?.full_name ?? null;
      }
    }
  }
  legal.rop_user_id = rop_user_id;
  legal.rop_name = rop_name;

  const childrenRes = await pool.query<OneCLegalChild>(
    `SELECT id_1c::text, name, inn FROM exchange_legals_raw WHERE parent_1c = $1 ORDER BY name ASC LIMIT 200`,
    [id1c],
  );
  const siblingsRes = legal.parent_1c
    ? await pool.query<OneCLegalSibling>(
        `SELECT id_1c::text, name, inn FROM exchange_legals_raw
         WHERE parent_1c = $1::uuid AND id_1c <> $2::uuid
         ORDER BY name ASC LIMIT 200`,
        [legal.parent_1c, id1c],
      )
    : { rows: [] as OneCLegalSibling[] };
  const storesRes = await pool.query<OneCStoreListRow>(
    `${ONE_C_STORE_LIST_SELECT}
     ${ONE_C_STORE_LIST_JOINS}
     WHERE s.legal_entity_1c = $1
     ORDER BY s.address ASC NULLS LAST
     LIMIT 500`,
    [id1c],
  );
  const stores = await attachDistributionFill(pool, storesRes.rows);
  return { legal, children: childrenRes.rows, siblings: siblingsRes.rows, stores };
}

export async function handleOneCOverview(_req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const data = await fetchOneCOverview(pool);
  sendJson(res, 200, { success: true, ...data });
}

export async function handleOneCHierarchy(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const data = await fetchOneCHierarchy(pool, parseSearch(req));
  sendJson(res, 200, { success: true, ...data });
}

export async function handleOneCRop(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const userId = parseUserId(req);
  if (!userId) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "user_id обязателен." });
    return;
  }
  const data = await fetchOneCRop(pool, userId);
  if (!data) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "РОП не найден." });
    return;
  }
  sendJson(res, 200, { success: true, ...data });
}

export async function handleOneCRm(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const userId = parseUserId(req);
  if (!userId) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "user_id обязателен." });
    return;
  }
  const { limit, offset } = parseLimitOffset(req);
  const data = await fetchOneCRm(pool, userId, parseSearch(req), limit, offset);
  if (!data) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "РМ не найден." });
    return;
  }
  sendJson(res, 200, { success: true, limit, offset, ...data });
}

export async function handleOneCManager(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const userId = parseUserId(req);
  if (!userId) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "user_id обязателен." });
    return;
  }
  const { limit, offset } = parseLimitOffset(req);
  const data = await fetchOneCManager(pool, userId, parseSearch(req), limit, offset);
  if (!data) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Менеджер не найден." });
    return;
  }
  sendJson(res, 200, { success: true, limit, offset, ...data });
}

export async function handleOneCStores(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const { limit, offset } = parseLimitOffset(req);
  const data = await fetchOneCStores(pool, parseSearch(req), limit, offset, parseOnlyActive(req));
  sendJson(res, 200, { success: true, limit, offset, onlyActive: parseOnlyActive(req), ...data });
}

export async function handleOneCStore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  viewerUserId?: string | null,
) {
  const id1c = String(req.query.id_1c ?? "").trim();
  if (!id1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const store = await fetchOneCStoreWithDistribution(pool, id1c, viewerUserId ?? null);
  if (!store) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Торговая точка не найдена." });
    return;
  }
  sendJson(res, 200, { success: true, store });
}

export async function handleOneCLegals(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const { limit, offset } = parseLimitOffset(req);
  const data = await fetchOneCLegals(
    pool,
    parseSearch(req),
    limit,
    offset,
    parseOnlyActive(req),
    parseHasDistribution(req),
  );
  sendJson(res, 200, {
    success: true,
    limit,
    offset,
    onlyActive: parseOnlyActive(req),
    hasDistribution: parseHasDistribution(req),
    ...data,
  });
}

export async function handleOneCLegal(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const id1c = String(req.query.id_1c ?? "").trim();
  if (!id1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const data = await fetchOneCLegal(pool, id1c);
  if (!data) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Юрлицо не найдено." });
    return;
  }
  sendJson(res, 200, { success: true, ...data });
}

/** Used in unit tests — manager stores via responsible_manager_name. */
export async function countStoresForManagerNames(
  pool: PoolLike,
  matchedNames: string[],
): Promise<number> {
  if (matchedNames.length === 0) return 0;
  const res = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM exchange_legals_raw l
     JOIN exchange_stores_raw s ON s.legal_entity_1c::text = l.id_1c::text
     WHERE l.responsible_manager_name = ANY($1::text[])`,
    [matchedNames],
  );
  return res.rows[0]?.n ?? 0;
}
