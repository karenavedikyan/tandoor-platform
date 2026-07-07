/**
 * Read-only handlers for /1c/* showroom (shadow tables only).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../server/db/neon-client.js";
import { sendJson } from "./admin/admin-auth.js";

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
  return String(req.query.q ?? "").trim();
}

export type OneCOverview = {
  stores: number;
  users: number;
  legals: number;
  last_imported_at: string | null;
};

export async function fetchOneCOverview(pool: PoolLike): Promise<OneCOverview> {
  const res = await pool.query<OneCOverview>(
    `SELECT
       (SELECT COUNT(*)::int FROM exchange_stores_raw) AS stores,
       (SELECT COUNT(*)::int FROM exchange_users_raw) AS users,
       (SELECT COUNT(*)::int FROM exchange_legals_raw) AS legals,
       GREATEST(
         COALESCE((SELECT MAX(imported_at) FROM exchange_stores_raw), 'epoch'::timestamptz),
         COALESCE((SELECT MAX(imported_at) FROM exchange_users_raw), 'epoch'::timestamptz),
         COALESCE((SELECT MAX(imported_at) FROM exchange_legals_raw), 'epoch'::timestamptz)
       ) AS last_imported_at`,
  );
  const row = res.rows[0];
  return {
    stores: row?.stores ?? 0,
    users: row?.users ?? 0,
    legals: row?.legals ?? 0,
    last_imported_at:
      row?.last_imported_at && row.last_imported_at !== "1970-01-01T00:00:00.000Z"
        ? String(row.last_imported_at)
        : null,
  };
}

export type OneCTeamMember = {
  id_1c: string;
  name: string;
  phone: string | null;
  store_count: number;
};

export async function fetchOneCTeam(pool: PoolLike, q: string) {
  const pattern = q ? `%${q}%` : null;
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM exchange_users_raw u
     WHERE ($1::text IS NULL OR u.name ILIKE $1)`,
    [pattern],
  );
  const rows = await pool.query<OneCTeamMember>(
    `SELECT u.id_1c, u.name, u.phone, COUNT(s.id_1c)::int AS store_count
     FROM exchange_users_raw u
     LEFT JOIN exchange_stores_raw s ON s.manager_1c = u.id_1c
     WHERE ($1::text IS NULL OR u.name ILIKE $1)
     GROUP BY u.id_1c, u.name, u.phone
     ORDER BY store_count DESC, u.name ASC`,
    [pattern],
  );
  return { total: countRes.rows[0]?.n ?? 0, items: rows.rows };
}

export type OneCManagerDetail = {
  id_1c: string;
  name: string;
  phone: string | null;
  store_count: number;
};

export type OneCManagerStoreRow = {
  id_1c: string;
  address: string | null;
  legal_name: string | null;
  legal_inn: string | null;
  legal_city: string | null;
};

export async function fetchOneCManager(pool: PoolLike, id1c: string, q: string) {
  const userRes = await pool.query<OneCManagerDetail>(
    `SELECT u.id_1c, u.name, u.phone,
            (SELECT COUNT(*)::int FROM exchange_stores_raw s WHERE s.manager_1c = u.id_1c) AS store_count
     FROM exchange_users_raw u WHERE u.id_1c = $1 LIMIT 1`,
    [id1c],
  );
  const user = userRes.rows[0];
  if (!user) return null;

  const pattern = q ? `%${q}%` : null;
  const storesRes = await pool.query<OneCManagerStoreRow>(
    `SELECT s.id_1c, s.address, l.name AS legal_name, l.inn AS legal_inn, l.city AS legal_city
     FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     WHERE s.manager_1c = $1
       AND (
         $2::text IS NULL
         OR s.address ILIKE $2
         OR l.name ILIKE $2
         OR l.legal_name ILIKE $2
       )
     ORDER BY s.address ASC NULLS LAST`,
    [id1c, pattern],
  );
  return { user, stores: storesRes.rows };
}

export type OneCStoreListItem = {
  id_1c: string;
  address: string | null;
  manager_name: string | null;
  legal_name: string | null;
  legal_inn: string | null;
  legal_city: string | null;
};

export async function fetchOneCStores(pool: PoolLike, q: string, limit: number, offset: number) {
  const pattern = q ? `%${q}%` : null;
  const where = `WHERE (
    $1::text IS NULL
    OR s.address ILIKE $1
    OR s.manager_name ILIKE $1
    OR l.name ILIKE $1
    OR l.legal_name ILIKE $1
    OR l.inn ILIKE $1
  )`;
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
     FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     ${where}`,
    [pattern],
  );
  const rows = await pool.query<OneCStoreListItem>(
    `SELECT s.id_1c, s.address, s.manager_name, l.name AS legal_name, l.inn AS legal_inn, l.city AS legal_city
     FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     ${where}
     ORDER BY s.address ASC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [pattern, limit, offset],
  );
  return { total: countRes.rows[0]?.n ?? 0, items: rows.rows };
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
};

export async function fetchOneCStore(pool: PoolLike, id1c: string): Promise<OneCStoreDetail | null> {
  const res = await pool.query<OneCStoreDetail>(
    `SELECT
       s.id_1c, s.address, s.name, s.status, s.imported_at,
       s.manager_1c, s.manager_name, s.manager_phone,
       s.legal_entity_1c,
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
       l.parent_1c AS legal_parent_1c,
       p.name AS legal_parent_name,
       p.inn AS legal_parent_inn
     FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     WHERE s.id_1c = $1
     LIMIT 1`,
    [id1c],
  );
  return res.rows[0] ?? null;
}

export type OneCLegalListItem = {
  id_1c: string;
  name: string;
  legal_name: string | null;
  inn: string | null;
  kpp: string | null;
  city: string | null;
  responsible_manager_name: string | null;
  plan_sum: number | null;
};

export async function fetchOneCLegals(pool: PoolLike, q: string, limit: number, offset: number) {
  const pattern = q ? `%${q}%` : null;
  const where = `WHERE ($1::text IS NULL OR l.name ILIKE $1 OR l.legal_name ILIKE $1 OR l.inn ILIKE $1)`;
  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM exchange_legals_raw l ${where}`,
    [pattern],
  );
  const rows = await pool.query<OneCLegalListItem>(
    `SELECT l.id_1c, l.name, l.legal_name, l.inn, l.kpp, l.city,
            l.responsible_manager_name, l.plan_sum
     FROM exchange_legals_raw l
     ${where}
     ORDER BY l.name ASC
     LIMIT $2 OFFSET $3`,
    [pattern, limit, offset],
  );
  return { total: countRes.rows[0]?.n ?? 0, items: rows.rows };
}

export type OneCLegalChild = {
  id_1c: string;
  name: string;
  inn: string | null;
};

export type OneCLegalStoreRow = {
  id_1c: string;
  address: string | null;
  manager_name: string | null;
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
  regional_manager_1c: string | null;
  regional_manager_name: string | null;
  responsible_manager_1c: string | null;
  responsible_manager_name: string | null;
  furniture_manager_1c: string | null;
  furniture_manager_name: string | null;
  furniture_manager_phone: string | null;
  parent_1c: string | null;
  parent_name: string | null;
  parent_inn: string | null;
  plan_retro_bonus: string | null;
  plan_sum: number | null;
  imported_at: string;
  regional_manager_in_users: boolean;
  responsible_manager_in_users: boolean;
  furniture_manager_in_users: boolean;
};

export async function fetchOneCLegal(pool: PoolLike, id1c: string) {
  const res = await pool.query<OneCLegalDetail>(
    `SELECT
       l.id_1c, l.name, l.legal_name, l.inn, l.kpp, l.ogrn, l.ma_number, l.payment_form,
       l.region, l.city, l.client_type, l.phone, l.email,
       l.discount_code, l.discount_percent,
       l.regional_manager_1c, l.regional_manager_name,
       l.responsible_manager_1c, l.responsible_manager_name,
       l.furniture_manager_1c, l.furniture_manager_name, l.furniture_manager_phone,
       l.parent_1c, p.name AS parent_name, p.inn AS parent_inn,
       l.plan_retro_bonus, l.plan_sum, l.imported_at,
       EXISTS(SELECT 1 FROM exchange_users_raw u WHERE u.id_1c = l.regional_manager_1c) AS regional_manager_in_users,
       EXISTS(SELECT 1 FROM exchange_users_raw u WHERE u.id_1c = l.responsible_manager_1c) AS responsible_manager_in_users,
       EXISTS(SELECT 1 FROM exchange_users_raw u WHERE u.id_1c = l.furniture_manager_1c) AS furniture_manager_in_users
     FROM exchange_legals_raw l
     LEFT JOIN exchange_legals_raw p ON p.id_1c = l.parent_1c
     WHERE l.id_1c = $1
     LIMIT 1`,
    [id1c],
  );
  const legal = res.rows[0];
  if (!legal) return null;

  const childrenRes = await pool.query<OneCLegalChild>(
    `SELECT id_1c, name, inn FROM exchange_legals_raw WHERE parent_1c = $1 ORDER BY name ASC LIMIT 200`,
    [id1c],
  );
  const storesRes = await pool.query<OneCLegalStoreRow>(
    `SELECT id_1c, address, manager_name FROM exchange_stores_raw
     WHERE legal_entity_1c = $1 ORDER BY address ASC NULLS LAST LIMIT 500`,
    [id1c],
  );
  return { legal, children: childrenRes.rows, stores: storesRes.rows };
}

export async function handleOneCOverview(_req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const data = await fetchOneCOverview(pool);
  sendJson(res, 200, { success: true, ...data });
}

export async function handleOneCTeam(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const data = await fetchOneCTeam(pool, parseSearch(req));
  sendJson(res, 200, { success: true, ...data });
}

export async function handleOneCManager(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const id1c = String(req.query.id_1c ?? "").trim();
  if (!id1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const data = await fetchOneCManager(pool, id1c, parseSearch(req));
  if (!data) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Менеджер не найден." });
    return;
  }
  sendJson(res, 200, { success: true, ...data });
}

export async function handleOneCStores(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const { limit, offset } = parseLimitOffset(req);
  const data = await fetchOneCStores(pool, parseSearch(req), limit, offset);
  sendJson(res, 200, { success: true, limit, offset, ...data });
}

export async function handleOneCStore(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const id1c = String(req.query.id_1c ?? "").trim();
  if (!id1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const store = await fetchOneCStore(pool, id1c);
  if (!store) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Торговая точка не найдена." });
    return;
  }
  sendJson(res, 200, { success: true, store });
}

export async function handleOneCLegals(req: VercelRequest, res: VercelResponse, pool: PoolLike) {
  const { limit, offset } = parseLimitOffset(req);
  const data = await fetchOneCLegals(pool, parseSearch(req), limit, offset);
  sendJson(res, 200, { success: true, limit, offset, ...data });
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

/** Count stores per manager — used in unit tests. */
export async function countStoresForManager(
  pool: PoolLike,
  managerId: string,
): Promise<number> {
  const res = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM exchange_stores_raw WHERE manager_1c = $1`,
    [managerId],
  );
  return res.rows[0]?.n ?? 0;
}
