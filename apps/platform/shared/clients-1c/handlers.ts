import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import { sendJson } from "../admin/admin-auth.js";
import { fetchHistory1cForStore } from "../one-c-distribution-handlers.js";
import { requireClients1cAdmin } from "./auth.js";
import type {
  Clients1cDistributionRow,
  Clients1cHoldingHeader,
  Clients1cHoldingResponse,
  Clients1cListItem,
  Clients1cListQuery,
  Clients1cListResponse,
  Clients1cListSort,
  Clients1cOrderRow,
  Clients1cStoreResponse,
  Clients1cTriFilter,
  MvStore1cRow,
} from "./types.js";

const MV_STORE_SELECT = `
  store_id_1c::text,
  store_name,
  store_address,
  store_status,
  legal_id_1c::text,
  legal_name,
  legal_inn,
  legal_city,
  legal_region,
  holding_id_1c::text,
  holding_name,
  responsible_manager_1c::text,
  responsible_manager_name,
  regional_manager_1c::text,
  regional_manager_name,
  furniture_manager_1c::text,
  furniture_manager_name,
  store_manager_1c::text,
  store_manager_name,
  linked_trade_point_id::text,
  distribution_filled_count,
  distribution_total_targets,
  distribution_percent,
  orders_last_90d_count,
  orders_last_90d_amount,
  last_order_at,
  last_distribution_updated_at,
  refreshed_at
`;

function mapStoreRow(row: Record<string, unknown>): MvStore1cRow {
  return {
    store_id_1c: String(row.store_id_1c),
    store_name: String(row.store_name ?? ""),
    store_address: row.store_address != null ? String(row.store_address) : null,
    store_status: row.store_status != null ? String(row.store_status) : null,
    legal_id_1c: String(row.legal_id_1c),
    legal_name: row.legal_name != null ? String(row.legal_name) : null,
    legal_inn: row.legal_inn != null ? String(row.legal_inn) : null,
    legal_city: row.legal_city != null ? String(row.legal_city) : null,
    legal_region: row.legal_region != null ? String(row.legal_region) : null,
    holding_id_1c: String(row.holding_id_1c),
    holding_name: row.holding_name != null ? String(row.holding_name) : null,
    responsible_manager_1c: row.responsible_manager_1c != null ? String(row.responsible_manager_1c) : null,
    responsible_manager_name: row.responsible_manager_name != null ? String(row.responsible_manager_name) : null,
    regional_manager_1c: row.regional_manager_1c != null ? String(row.regional_manager_1c) : null,
    regional_manager_name: row.regional_manager_name != null ? String(row.regional_manager_name) : null,
    furniture_manager_1c: row.furniture_manager_1c != null ? String(row.furniture_manager_1c) : null,
    furniture_manager_name: row.furniture_manager_name != null ? String(row.furniture_manager_name) : null,
    store_manager_1c: row.store_manager_1c != null ? String(row.store_manager_1c) : null,
    store_manager_name: row.store_manager_name != null ? String(row.store_manager_name) : null,
    linked_trade_point_id: row.linked_trade_point_id != null ? String(row.linked_trade_point_id) : null,
    distribution_filled_count: Number(row.distribution_filled_count ?? 0),
    distribution_total_targets: Number(row.distribution_total_targets ?? 0),
    distribution_percent: Number(row.distribution_percent ?? 0),
    orders_last_90d_count: Number(row.orders_last_90d_count ?? 0),
    orders_last_90d_amount: Number(row.orders_last_90d_amount ?? 0),
    last_order_at: row.last_order_at != null ? String(row.last_order_at) : null,
    last_distribution_updated_at:
      row.last_distribution_updated_at != null ? String(row.last_distribution_updated_at) : null,
    refreshed_at: String(row.refreshed_at ?? ""),
  };
}

function mapListItem(row: Record<string, unknown>): Clients1cListItem {
  return {
    holding_id_1c: String(row.holding_id_1c),
    holding_name: String(row.holding_name ?? ""),
    holding_inn: row.holding_inn != null ? String(row.holding_inn) : null,
    holding_city: row.holding_city != null ? String(row.holding_city) : null,
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
  };
}

function mapHoldingHeader(row: Record<string, unknown>): Clients1cHoldingHeader {
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
    refreshed_at: String(row.refreshed_at ?? ""),
  };
}

function mapOrderRow(row: Record<string, unknown>): Clients1cOrderRow {
  return {
    id: String(row.id),
    order_number: String(row.order_number ?? ""),
    status: String(row.status ?? ""),
    delivery_type: row.delivery_type != null ? String(row.delivery_type) : null,
    total_with_discount:
      row.total_with_discount != null ? Number(row.total_with_discount) : null,
    total_discount: row.total_discount != null ? Number(row.total_discount) : null,
    created_at_bitrix: row.created_at_bitrix != null ? String(row.created_at_bitrix) : null,
    store_id_1c: row.store_id_1c != null ? String(row.store_id_1c) : null,
    store_name: row.store_name != null ? String(row.store_name) : null,
    store_city: row.store_city != null ? String(row.store_city) : null,
    legal_id_1c: row.legal_id_1c != null ? String(row.legal_id_1c) : null,
    legal_name: row.legal_name != null ? String(row.legal_name) : null,
    manager_name: row.manager_name != null ? String(row.manager_name) : null,
    items_count: Number(row.items_count ?? 0),
  };
}

function mapDistributionRow(row: Record<string, unknown>): Clients1cDistributionRow {
  return {
    store_id_1c: String(row.store_id_1c),
    target_kind: String(row.target_kind ?? ""),
    target_id: String(row.target_id ?? ""),
    status: row.status != null ? String(row.status) : null,
    placement_type: row.placement_type != null ? String(row.placement_type) : null,
    placement_segment: row.placement_segment != null ? String(row.placement_segment) : null,
    placement_capacity: row.placement_capacity != null ? Number(row.placement_capacity) : null,
    placement_actual: row.placement_actual != null ? Number(row.placement_actual) : null,
    placement_ref: row.placement_ref != null ? String(row.placement_ref) : null,
    placement_our_models: row.placement_our_models != null ? String(row.placement_our_models) : null,
    placement_competitors: row.placement_competitors != null ? String(row.placement_competitors) : null,
    source: String(row.source ?? ""),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    updated_by_name: row.updated_by_name != null ? String(row.updated_by_name) : null,
  };
}

export function parseClients1cListQuery(req: VercelRequest): Clients1cListQuery {
  const pageRaw = Number(req.query.page ?? 1);
  const pageSizeRaw = Number(req.query.pageSize ?? req.query.page_size ?? 50);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(Math.floor(pageSizeRaw), 200)
      : 50;

  const sortRaw = String(req.query.sort ?? "name").trim() as Clients1cListSort;
  const sort: Clients1cListSort = [
    "name",
    "stores_desc",
    "distribution_desc",
    "orders_desc",
    "last_order_desc",
  ].includes(sortRaw)
    ? sortRaw
    : "name";

  const tri = (v: unknown): Clients1cTriFilter => {
    const s = String(v ?? "any").trim().toLowerCase();
    if (s === "true" || s === "1") return "true";
    if (s === "false" || s === "0") return "false";
    return "any";
  };

  return {
    search: String(req.query.search ?? req.query.q ?? "").trim(),
    city: String(req.query.city ?? "").trim(),
    region: String(req.query.region ?? "").trim(),
    hasDistribution: tri(req.query.hasDistribution ?? req.query.has_distribution),
    hasOrders: tri(req.query.hasOrders ?? req.query.has_orders),
    sort,
    page,
    pageSize,
  };
}

function listOrderBy(sort: Clients1cListSort): string {
  switch (sort) {
    case "stores_desc":
      return "stores_count DESC, holding_name ASC";
    case "distribution_desc":
      return "distribution_percent DESC NULLS LAST, holding_name ASC";
    case "orders_desc":
      return "orders_last_90d_count DESC, holding_name ASC";
    case "last_order_desc":
      return "last_order_at DESC NULLS LAST, holding_name ASC";
    default:
      return "holding_name ASC";
  }
}

function buildListWhere(query: Clients1cListQuery): { clause: string; params: unknown[] } {
  const params: unknown[] = [];
  let idx = 1;
  const parts: string[] = ["1=1"];

  if (query.search) {
    parts.push(
      `(holding_name ILIKE $${idx} OR holding_inn ILIKE $${idx} OR holding_city ILIKE $${idx})`,
    );
    params.push(`%${query.search}%`);
    idx += 1;
  }
  if (query.city) {
    parts.push(`holding_city ILIKE $${idx}`);
    params.push(`%${query.city}%`);
    idx += 1;
  }
  if (query.region) {
    parts.push(`holding_region ILIKE $${idx}`);
    params.push(`%${query.region}%`);
    idx += 1;
  }
  if (query.hasDistribution === "true") {
    parts.push("distribution_total_targets > 0");
  } else if (query.hasDistribution === "false") {
    parts.push("(distribution_total_targets = 0 OR distribution_filled_count = 0)");
  }
  if (query.hasOrders === "true") {
    parts.push("orders_last_90d_count > 0");
  } else if (query.hasOrders === "false") {
    parts.push("orders_last_90d_count = 0");
  }

  return { clause: parts.join(" AND "), params };
}

export async function fetchClients1cList(
  pool: PoolLike,
  query: Clients1cListQuery,
): Promise<Clients1cListResponse> {
  const { clause, params } = buildListWhere(query);
  const offset = (query.page - 1) * query.pageSize;

  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM mv_clients_1c WHERE ${clause}`,
    params,
  );

  const listRes = await pool.query<Record<string, unknown>>(
    `SELECT
       holding_id_1c::text,
       holding_name,
       holding_inn,
       holding_city,
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
       refreshed_at
     FROM mv_clients_1c
     WHERE ${clause}
     ORDER BY ${listOrderBy(query.sort)}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, query.pageSize, offset],
  );

  const refreshedRes = await pool.query<{ refreshed_at: string | null }>(
    `SELECT MAX(refreshed_at)::text AS refreshed_at FROM mv_clients_1c`,
  );

  return {
    ok: true,
    items: listRes.rows.map(mapListItem),
    total: countRes.rows[0]?.n ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    refreshedAt: refreshedRes.rows[0]?.refreshed_at ?? null,
  };
}

export async function fetchClients1cHolding(
  pool: PoolLike,
  holdingId: string,
): Promise<Clients1cHoldingResponse | null> {
  const holdingRes = await pool.query<Record<string, unknown>>(
    `SELECT
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
       refreshed_at
     FROM mv_clients_1c
     WHERE holding_id_1c = $1::uuid
     LIMIT 1`,
    [holdingId],
  );
  const holdingRow = holdingRes.rows[0];
  if (!holdingRow) return null;

  const storesRes = await pool.query<Record<string, unknown>>(
    `SELECT ${MV_STORE_SELECT}
     FROM mv_stores_1c
     WHERE holding_id_1c = $1::uuid
     ORDER BY store_name ASC`,
    [holdingId],
  );

  const distRes = await pool.query<{ target_kind: string; total: number; filled: number }>(
    `SELECT
       vd.target_kind,
       COUNT(DISTINCT vd.target_id)::int AS total,
       COUNT(DISTINCT vd.target_id) FILTER (
         WHERE COALESCE(vd.placement_actual, 0) > 0
           OR vd.status IN ('installed', 'present', 'planned', 'confirmed')
       )::int AS filled
     FROM v_store_distribution vd
     INNER JOIN mv_stores_1c ms ON ms.store_id_1c = vd.store_id_1c
     WHERE ms.holding_id_1c = $1::uuid
     GROUP BY vd.target_kind
     ORDER BY vd.target_kind`,
    [holdingId],
  );

  const ordersRes = await pool.query<Record<string, unknown>>(
    `SELECT
       bo.id::text,
       bo.order_number,
       bo.status,
       bo.delivery_type,
       bo.total_with_discount,
       bo.total_discount,
       bo.created_at_bitrix,
       bo.store_uuid::text AS store_id_1c,
       ms.store_name,
       ms.legal_city AS store_city,
       bo.legal_uuid::text AS legal_id_1c,
       ms.legal_name,
       COALESCE(ms.store_manager_name, esr.manager_name) AS manager_name,
       (SELECT COUNT(*)::int FROM bitrix_order_items_snapshot i WHERE i.order_id = bo.id) AS items_count
     FROM bitrix_orders_snapshot bo
     INNER JOIN mv_stores_1c ms ON ms.store_id_1c = bo.store_uuid
     LEFT JOIN exchange_stores_raw esr ON esr.id_1c = bo.store_uuid
     WHERE ms.holding_id_1c = $1::uuid
       AND bo.created_at_bitrix >= NOW() - INTERVAL '90 days'
     ORDER BY bo.created_at_bitrix DESC NULLS LAST
     LIMIT 200`,
    [holdingId],
  );

  const distributionSummary: Record<string, { total: number; filled: number }> = {};
  for (const row of distRes.rows) {
    distributionSummary[row.target_kind] = {
      total: Number(row.total),
      filled: Number(row.filled),
    };
  }

  return {
    ok: true,
    holding: mapHoldingHeader(holdingRow),
    stores: storesRes.rows.map(mapStoreRow),
    distributionSummary,
    orders: ordersRes.rows.map(mapOrderRow),
  };
}

export async function fetchClients1cStore(
  pool: PoolLike,
  holdingId: string,
  storeId: string,
): Promise<Clients1cStoreResponse | null> {
  const storeRes = await pool.query<Record<string, unknown>>(
    `SELECT ${MV_STORE_SELECT}
     FROM mv_stores_1c
     WHERE store_id_1c = $1::uuid AND holding_id_1c = $2::uuid
     LIMIT 1`,
    [storeId, holdingId],
  );
  const storeRow = storeRes.rows[0];
  if (!storeRow) return null;

  const [distRes, ordersRes, historyRes] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `SELECT
         store_id_1c::text,
         target_kind,
         target_id,
         status,
         placement_type,
         placement_segment,
         placement_capacity,
         placement_actual,
         placement_ref,
         placement_our_models,
         placement_competitors,
         source,
         updated_at,
         updated_by_name
       FROM v_store_distribution
       WHERE store_id_1c = $1::uuid
       ORDER BY target_kind, target_id`,
      [storeId],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT
         bo.id::text,
         bo.order_number,
         bo.status,
         bo.delivery_type,
         bo.total_with_discount,
         bo.total_discount,
         bo.created_at_bitrix,
         bo.store_uuid::text AS store_id_1c,
         ms.store_name,
         ms.legal_city AS store_city,
         bo.legal_uuid::text AS legal_id_1c,
         ms.legal_name,
         COALESCE(ms.store_manager_name, esr.manager_name) AS manager_name,
         (SELECT COUNT(*)::int FROM bitrix_order_items_snapshot i WHERE i.order_id = bo.id) AS items_count
       FROM bitrix_orders_snapshot bo
       LEFT JOIN mv_stores_1c ms ON ms.store_id_1c = bo.store_uuid
       LEFT JOIN exchange_stores_raw esr ON esr.id_1c = bo.store_uuid
       WHERE bo.store_uuid = $1::uuid
         AND bo.created_at_bitrix >= NOW() - INTERVAL '90 days'
       ORDER BY bo.created_at_bitrix DESC NULLS LAST
       LIMIT 200`,
      [storeId],
    ),
    fetchHistory1cForStore(pool, storeId, 20, 0),
  ]);

  return {
    ok: true,
    store: mapStoreRow(storeRow),
    distribution: distRes.rows.map(mapDistributionRow),
    orders: ordersRes.rows.map(mapOrderRow),
    history: historyRes.items,
  };
}

export async function handleClients1cList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }
  const me = await requireClients1cAdmin(req, res, pool);
  if (!me) return;

  const query = parseClients1cListQuery(req);
  const data = await fetchClients1cList(pool, query);
  sendJson(res, 200, data);
}

export async function handleClients1cHolding(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  holdingId: string,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }
  const me = await requireClients1cAdmin(req, res, pool);
  if (!me) return;

  if (!holdingId.trim()) {
    sendJson(res, 400, { ok: false, code: "BAD_REQUEST", message: "holdingId обязателен." });
    return;
  }

  const data = await fetchClients1cHolding(pool, holdingId.trim());
  if (!data) {
    sendJson(res, 404, { ok: false, code: "NOT_FOUND", message: "Клиент не найден." });
    return;
  }
  sendJson(res, 200, data);
}

export async function handleClients1cStore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  holdingId: string,
  storeId: string,
): Promise<void> {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
    return;
  }
  const me = await requireClients1cAdmin(req, res, pool);
  if (!me) return;

  const h = holdingId.trim();
  const s = storeId.trim();
  if (!h || !s) {
    sendJson(res, 400, { ok: false, code: "BAD_REQUEST", message: "holdingId и storeId обязательны." });
    return;
  }

  const data = await fetchClients1cStore(pool, h, s);
  if (!data) {
    sendJson(res, 404, {
      ok: false,
      code: "NOT_FOUND",
      message: "Торговая точка не найдена или не принадлежит клиенту.",
    });
    return;
  }
  sendJson(res, 200, data);
}
