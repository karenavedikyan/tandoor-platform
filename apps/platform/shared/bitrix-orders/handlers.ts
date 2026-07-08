/**
 * Read-only handlers for Bitrix orders in /1c/* showroom.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import { sendJson } from "../admin/admin-auth.js";
import {
  canEditDistributionForStore1c,
  type OneCDistributionUser,
} from "../one-c-distribution-permissions.js";
import {
  loadOneCShowroomContext,
  teamContextForUser,
} from "../one-c-showroom-context.js";

type OrderListRow = {
  id: string;
  order_number: string;
  status: string;
  delivery_type: string | null;
  total_with_discount: string | null;
  total_discount: string | null;
  created_at_bitrix: string | null;
  client_number_1c: string | null;
  store_id_1c: string | null;
  store_name: string | null;
  store_city: string | null;
  legal_id_1c: string | null;
  legal_name: string | null;
  manager_1c: string | null;
  manager_name: string | null;
  items_count: number;
};

type OrderItemRow = {
  line_no: number;
  product_xml_id: string;
  product_id: string | null;
  product_name_1c: string | null;
  quantity: string;
  discount_per_item: string | null;
  price_no_discount: string | null;
  discount_id: string | null;
  product_id_1c_internal: string | null;
  price_type_uuid: string | null;
  supply_variant: string | null;
  supply_date: string | null;
  catalog_product_name: string | null;
};

export type BitrixOrderListDto = {
  id: string;
  order_number: string;
  status: string;
  delivery_type: string | null;
  total_with_discount: number | null;
  total_discount: number | null;
  created_at_bitrix: string | null;
  client_number_1c: string | null;
  store: { id_1c: string; name: string; city: string | null } | null;
  legal: { id_1c: string; name: string } | null;
  manager: { manager_1c: string; name: string | null } | null;
  items_count: number;
};

export type BitrixOrderDetailDto = BitrixOrderListDto & {
  site_id: string | null;
  client_uuid: string | null;
  delivery_address: string | null;
  payment_method: string | null;
  payment_percent: number | null;
  source_file: string | null;
  imported_at: string;
  updated_at: string;
  items: Array<{
    line_no: number;
    product_xml_id: string;
    product_id: string | null;
    product_name_1c: string | null;
    product_name: string | null;
    quantity: number;
    discount_per_item: number | null;
    price_no_discount: number | null;
    discount_id: string | null;
    product_id_1c_internal: string | null;
    price_type_uuid: string | null;
    supply_variant: string | null;
    supply_date: string | null;
  }>;
};

function parseLimitOffset(req: VercelRequest, defaultLimit = 50, maxLimit = 200) {
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

function parseStatus(req: VercelRequest): string {
  return String(req.query.status ?? "").trim();
}

function parseScope(req: VercelRequest): "all" | "unassigned" {
  const raw = String(req.query.scope ?? "all").trim().toLowerCase();
  return raw === "unassigned" ? "unassigned" : "all";
}

function parseDateFrom(req: VercelRequest): string | null {
  const v = String(req.query.dateFrom ?? req.query.date_from ?? "").trim();
  return v || null;
}

function parseDateTo(req: VercelRequest): string | null {
  const v = String(req.query.dateTo ?? req.query.date_to ?? "").trim();
  return v || null;
}

function numOrNull(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapOrderRow(row: OrderListRow): BitrixOrderListDto {
  return {
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    delivery_type: row.delivery_type,
    total_with_discount: numOrNull(row.total_with_discount),
    total_discount: numOrNull(row.total_discount),
    created_at_bitrix: row.created_at_bitrix,
    client_number_1c: row.client_number_1c,
    store:
      row.store_id_1c && row.store_name
        ? { id_1c: row.store_id_1c, name: row.store_name, city: row.store_city }
        : row.store_id_1c
          ? { id_1c: row.store_id_1c, name: row.store_name ?? row.store_id_1c, city: row.store_city }
          : null,
    legal:
      row.legal_id_1c && row.legal_name
        ? { id_1c: row.legal_id_1c, name: row.legal_name }
        : row.legal_id_1c
          ? { id_1c: row.legal_id_1c, name: row.legal_name ?? row.legal_id_1c }
          : null,
    manager:
      row.manager_1c
        ? { manager_1c: row.manager_1c, name: row.manager_name }
        : null,
    items_count: row.items_count,
  };
}

const ORDER_LIST_FROM = `FROM bitrix_orders_snapshot o
  LEFT JOIN exchange_stores_raw s ON s.id_1c = o.store_uuid
  LEFT JOIN exchange_legals_raw leg_store ON leg_store.id_1c = s.legal_entity_1c
  LEFT JOIN exchange_legals_raw leg ON leg.id_1c = COALESCE(o.legal_uuid, s.legal_entity_1c)
  LEFT JOIN LATERAL (
    SELECT es.manager_name
    FROM exchange_stores_raw es
    WHERE es.manager_1c = o.manager_uuid
    ORDER BY es.imported_at DESC NULLS LAST
    LIMIT 1
  ) mgr ON TRUE`;

const ORDER_LIST_SELECT = `SELECT
  o.id::text,
  o.order_number,
  o.status,
  o.delivery_type,
  o.total_with_discount::text,
  o.total_discount::text,
  o.created_at_bitrix,
  o.client_number_1c,
  s.id_1c::text AS store_id_1c,
  COALESCE(NULLIF(btrim(s.name), ''), NULLIF(btrim(s.address), '')) AS store_name,
  COALESCE(leg_store.city, leg.city) AS store_city,
  leg.id_1c::text AS legal_id_1c,
  leg.name AS legal_name,
  o.manager_uuid::text AS manager_1c,
  COALESCE(s.manager_name, mgr.manager_name) AS manager_name,
  (SELECT COUNT(*)::int FROM bitrix_order_items_snapshot i WHERE i.order_id = o.id) AS items_count`;

type RbacClause = { sql: string; params: unknown[] };

async function resolveViewer(
  pool: PoolLike,
  userId: string,
): Promise<OneCDistributionUser | null> {
  const res = await pool.query<OneCDistributionUser>(
    `SELECT id::text AS id, role::text AS role, status, full_name
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  );
  return res.rows[0] ?? null;
}

async function resolveAllowedManagerUuids(
  pool: PoolLike,
  viewer: OneCDistributionUser,
): Promise<string[] | null> {
  if (viewer.role === "admin" || viewer.role === "director") return null;

  const ctx = await loadOneCShowroomContext(pool);

  if (viewer.role === "manager") {
    const names = ctx.matchedResponsibleByUserId.get(viewer.id) ?? [];
    if (names.length === 0) return [];
    const res = await pool.query<{ manager_1c: string }>(
      `SELECT DISTINCT s.manager_1c::text
       FROM exchange_stores_raw s
       INNER JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
       WHERE l.responsible_manager_name = ANY($1::text[])
         AND s.manager_1c IS NOT NULL`,
      [names],
    );
    return res.rows.map((r) => r.manager_1c);
  }

  if (viewer.role === "regional_manager") {
    const names = ctx.matchedRegionalByUserId.get(viewer.id) ?? [];
    if (names.length === 0) return [];
    const res = await pool.query<{ manager_1c: string }>(
      `SELECT DISTINCT s.manager_1c::text
       FROM exchange_stores_raw s
       INNER JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
       WHERE l.regional_manager_name = ANY($1::text[])
         AND s.manager_1c IS NOT NULL`,
      [names],
    );
    return res.rows.map((r) => r.manager_1c);
  }

  if (viewer.role === "rop") {
    const { team } = teamContextForUser(viewer.id, ctx);
    if (!team) return [];
    const mgrUsers = (ctx.membershipsByTeam.get(team.id) ?? []).filter(
      (m) => m.role_in_team === "manager",
    );
    const allNames = mgrUsers.flatMap((m) => ctx.matchedResponsibleByUserId.get(m.id) ?? []);
    if (allNames.length === 0) return [];
    const res = await pool.query<{ manager_1c: string }>(
      `SELECT DISTINCT s.manager_1c::text
       FROM exchange_stores_raw s
       INNER JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
       WHERE l.responsible_manager_name = ANY($1::text[])
         AND s.manager_1c IS NOT NULL`,
      [allNames],
    );
    return res.rows.map((r) => r.manager_1c);
  }

  return [];
}

function buildRbacClause(
  viewer: OneCDistributionUser,
  allowedManagerUuids: string[] | null,
  paramOffset: number,
): RbacClause {
  if (allowedManagerUuids === null) return { sql: "", params: [] };
  if (allowedManagerUuids.length === 0) {
    return { sql: "AND FALSE", params: [] };
  }
  return {
    sql: `AND o.manager_uuid = ANY($${paramOffset}::uuid[])`,
    params: [allowedManagerUuids],
  };
}

function buildListFilters(
  search: string,
  status: string,
  dateFrom: string | null,
  dateTo: string | null,
  scope: "all" | "unassigned",
  paramStart: number,
): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let idx = paramStart;

  if (scope === "unassigned") {
    clauses.push("o.store_uuid IS NULL AND o.legal_uuid IS NULL");
  }

  if (search) {
    clauses.push(`(
      o.order_number ILIKE $${idx}
      OR o.client_number_1c ILIKE $${idx}
      OR s.name ILIKE $${idx}
      OR s.address ILIKE $${idx}
      OR leg.name ILIKE $${idx}
    )`);
    params.push(`%${search}%`);
    idx += 1;
  }

  if (status) {
    clauses.push(`o.status = $${idx}`);
    params.push(status);
    idx += 1;
  }

  if (dateFrom) {
    clauses.push(`o.created_at_bitrix >= $${idx}::timestamptz`);
    params.push(dateFrom);
    idx += 1;
  }

  if (dateTo) {
    clauses.push(`o.created_at_bitrix < ($${idx}::date + interval '1 day')`);
    params.push(dateTo);
    idx += 1;
  }

  const sql = clauses.length > 0 ? `AND ${clauses.join(" AND ")}` : "";
  return { sql, params };
}

async function queryOrders(
  pool: PoolLike,
  viewer: OneCDistributionUser,
  opts: {
    search: string;
    status: string;
    dateFrom: string | null;
    dateTo: string | null;
    scope: "all" | "unassigned";
    limit: number;
    offset: number;
    storeId1c?: string;
    legalId1c?: string;
  },
): Promise<{ total: number; orders: BitrixOrderListDto[] }> {
  const allowedManagerUuids = await resolveAllowedManagerUuids(pool, viewer);
  const params: unknown[] = [];
  let idx = 1;

  const extra: string[] = [];
  if (opts.storeId1c) {
    extra.push(`o.store_uuid = $${idx}::uuid`);
    params.push(opts.storeId1c);
    idx += 1;
  }
  if (opts.legalId1c) {
    extra.push(`o.legal_uuid = $${idx}::uuid`);
    params.push(opts.legalId1c);
    idx += 1;
  }

  const rbac = buildRbacClause(viewer, allowedManagerUuids, idx);
  if (rbac.params.length > 0) {
    params.push(...rbac.params);
    idx += rbac.params.length;
  }

  const filters = buildListFilters(
    opts.search,
    opts.status,
    opts.dateFrom,
    opts.dateTo,
    opts.scope,
    idx,
  );
  params.push(...filters.params);
  idx += filters.params.length;

  const where = `WHERE TRUE ${extra.length ? `AND ${extra.join(" AND ")}` : ""} ${rbac.sql} ${filters.sql}`;

  const countRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n ${ORDER_LIST_FROM} ${where}`,
    params,
  );

  const limitIdx = idx;
  const offsetIdx = idx + 1;
  const rows = await pool.query<OrderListRow>(
    `${ORDER_LIST_SELECT}
     ${ORDER_LIST_FROM}
     ${where}
     ORDER BY o.created_at_bitrix DESC NULLS LAST, o.order_number DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, opts.limit, opts.offset],
  );

  return {
    total: countRes.rows[0]?.n ?? 0,
    orders: rows.rows.map(mapOrderRow),
  };
}

async function fetchOrderById(pool: PoolLike, orderId: string): Promise<OrderListRow | null> {
  const res = await pool.query<OrderListRow>(
    `${ORDER_LIST_SELECT}
     ${ORDER_LIST_FROM}
     WHERE o.id = $1::uuid
     LIMIT 1`,
    [orderId],
  );
  return res.rows[0] ?? null;
}

async function orderPassesRbac(
  pool: PoolLike,
  viewer: OneCDistributionUser,
  orderId: string,
): Promise<boolean> {
  const allowed = await resolveAllowedManagerUuids(pool, viewer);
  if (allowed === null) return true;
  if (allowed.length === 0) return false;
  const res = await pool.query<{ ok: number }>(
    `SELECT 1::int AS ok FROM bitrix_orders_snapshot
     WHERE id = $1::uuid AND manager_uuid = ANY($2::uuid[])
     LIMIT 1`,
    [orderId, allowed],
  );
  return (res.rows[0]?.ok ?? 0) === 1;
}

async function fetchOrderItems(pool: PoolLike, orderId: string) {
  const res = await pool.query<OrderItemRow>(
    `SELECT
       i.line_no,
       i.product_xml_id,
       i.product_id::text,
       i.product_name_1c,
       i.quantity::text,
       i.discount_per_item::text,
       i.price_no_discount::text,
       i.discount_id,
       i.product_id_1c_internal,
       i.price_type_uuid,
       i.supply_variant,
       i.supply_date,
       cp.name AS catalog_product_name
     FROM bitrix_order_items_snapshot i
     LEFT JOIN catalog_products cp ON cp.id = i.product_id
     WHERE i.order_id = $1::uuid
     ORDER BY i.line_no ASC`,
    [orderId],
  );
  return res.rows.map((row) => ({
    line_no: row.line_no,
    product_xml_id: row.product_xml_id,
    product_id: row.product_id,
    product_name_1c: row.product_name_1c,
    product_name: row.catalog_product_name ?? row.product_name_1c,
    quantity: numOrNull(row.quantity) ?? 0,
    discount_per_item: numOrNull(row.discount_per_item),
    price_no_discount: numOrNull(row.price_no_discount),
    discount_id: row.discount_id,
    product_id_1c_internal: row.product_id_1c_internal,
    price_type_uuid: row.price_type_uuid,
    supply_variant: row.supply_variant,
    supply_date: row.supply_date,
  }));
}

export async function handleBitrixOrders(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  viewerUserId: string,
): Promise<void> {
  const viewer = await resolveViewer(pool, viewerUserId);
  if (!viewer) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Пользователь не найден." });
    return;
  }

  const scope = parseScope(req);
  if (scope === "unassigned" && viewer.role !== "admin") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Непривязанные заказы — только для админа." });
    return;
  }

  const { limit, offset } = parseLimitOffset(req);
  const data = await queryOrders(pool, viewer, {
    search: parseSearch(req),
    status: parseStatus(req),
    dateFrom: parseDateFrom(req),
    dateTo: parseDateTo(req),
    scope,
    limit,
    offset,
  });

  sendJson(res, 200, {
    success: true,
    orders: data.orders,
    total: data.total,
    limit,
    offset,
    scope,
  });
}

export async function handleBitrixOrdersForStore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  viewerUserId: string,
): Promise<void> {
  const storeId1c = String(req.query.store_id_1c ?? "").trim();
  if (!storeId1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "store_id_1c обязателен." });
    return;
  }

  const canView = await canEditDistributionForStore1c(pool, viewerUserId, storeId1c);
  const viewer = await resolveViewer(pool, viewerUserId);
  if (!viewer) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Пользователь не найден." });
    return;
  }
  if (!canView && viewer.role !== "admin" && viewer.role !== "director") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Нет доступа к этой торговой точке." });
    return;
  }

  const { limit, offset } = parseLimitOffset(req, 20, 200);
  const data = await queryOrders(pool, viewer, {
    search: "",
    status: "",
    dateFrom: null,
    dateTo: null,
    scope: "all",
    limit,
    offset,
    storeId1c,
  });

  sendJson(res, 200, { success: true, orders: data.orders, total: data.total, limit, offset });
}

export async function handleBitrixOrdersForLegal(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  viewerUserId: string,
): Promise<void> {
  const legalId1c = String(req.query.legal_id_1c ?? "").trim();
  if (!legalId1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "legal_id_1c обязателен." });
    return;
  }

  const viewer = await resolveViewer(pool, viewerUserId);
  if (!viewer) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Пользователь не найден." });
    return;
  }

  const { limit, offset } = parseLimitOffset(req, 20, 200);
  const data = await queryOrders(pool, viewer, {
    search: "",
    status: "",
    dateFrom: null,
    dateTo: null,
    scope: "all",
    limit,
    offset,
    legalId1c,
  });

  sendJson(res, 200, { success: true, orders: data.orders, total: data.total, limit, offset });
}

export async function handleBitrixOrder(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  viewerUserId: string,
): Promise<void> {
  const orderId = String(req.query.order_id ?? "").trim();
  if (!orderId) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "order_id обязателен." });
    return;
  }

  const viewer = await resolveViewer(pool, viewerUserId);
  if (!viewer) {
    sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Пользователь не найден." });
    return;
  }

  const allowed = await orderPassesRbac(pool, viewer, orderId);
  if (!allowed) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Нет доступа к этому заказу." });
    return;
  }

  const row = await fetchOrderById(pool, orderId);
  if (!row) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Заказ не найден." });
    return;
  }

  const detailRes = await pool.query<{
    site_id: string | null;
    client_uuid: string | null;
    delivery_address: string | null;
    payment_method: string | null;
    payment_percent: string | null;
    source_file: string | null;
    imported_at: string;
    updated_at: string;
  }>(
    `SELECT site_id, client_uuid, delivery_address, payment_method,
            payment_percent::text, source_file, imported_at, updated_at
     FROM bitrix_orders_snapshot WHERE id = $1::uuid`,
    [orderId],
  );
  const extra = detailRes.rows[0];
  const items = await fetchOrderItems(pool, orderId);

  const order: BitrixOrderDetailDto = {
    ...mapOrderRow(row),
    site_id: extra?.site_id ?? null,
    client_uuid: extra?.client_uuid ?? null,
    delivery_address: extra?.delivery_address ?? null,
    payment_method: extra?.payment_method ?? null,
    payment_percent: numOrNull(extra?.payment_percent ?? null),
    source_file: extra?.source_file ?? null,
    imported_at: extra?.imported_at ?? "",
    updated_at: extra?.updated_at ?? "",
    items,
  };

  sendJson(res, 200, { success: true, order });
}
