/**
 * DB + business logic for exchange_stores_raw shadow table.
 * Only SELECT on trade_points/dealers — no writes to production tables.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../server/db/neon-client.js";
import type { DbUserRow } from "./admin-auth.js";
import { sendJson } from "./admin-auth.js";
import type { ExchangeStoreRawRow } from "./exchange-stores-xml-parser.js";

export type ExchangeStoreStatus = "new" | "linked" | "ignored" | "created";

export type ExchangeStoreListItem = {
  id_1c: string;
  name: string;
  address: string | null;
  legal_entity_1c: string | null;
  manager_1c: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  status: ExchangeStoreStatus;
  linked_trade_point_id: string | null;
  linked_trade_point_name: string | null;
  linked_dealer_id: string | null;
  linked_at: string | null;
  linked_by: string | null;
  imported_at: string;
  match_candidates_count: number;
};

export type UpsertStats = {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped_locked: number;
};

const LOCKED_STATUSES = new Set<ExchangeStoreStatus>(["linked", "ignored", "created"]);

function collapseWs(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function rowFieldsEqual(a: ExchangeStoreRawRow, b: Record<string, unknown>): boolean {
  return (
    a.name === b.name &&
    (a.address ?? null) === (b.address ?? null) &&
    (a.legal_entity_1c ?? null) === (b.legal_entity_1c ?? null) &&
    (a.manager_1c ?? null) === (b.manager_1c ?? null) &&
    (a.manager_name ?? null) === (b.manager_name ?? null) &&
    (a.manager_phone ?? null) === (b.manager_phone ?? null)
  );
}

type ExistingRow = {
  id_1c: string;
  status: ExchangeStoreStatus;
  name: string;
  address: string | null;
  legal_entity_1c: string | null;
  manager_1c: string | null;
  manager_name: string | null;
  manager_phone: string | null;
};

export async function upsertExchangeStoresBatch(
  pool: PoolLike,
  rows: ExchangeStoreRawRow[],
  sourceFile: string,
): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, unchanged: 0, skipped_locked: 0 };
  if (rows.length === 0) return stats;

  const ids = rows.map((r) => r.id_1c);
  const existingRes = await pool.query<ExistingRow>(
    `SELECT id_1c, status, name, address, legal_entity_1c, manager_1c, manager_name, manager_phone
     FROM exchange_stores_raw
     WHERE id_1c = ANY($1::uuid[])`,
    [ids],
  );
  const existingMap = new Map(existingRes.rows.map((r) => [r.id_1c, r]));

  for (const row of rows) {
    const ex = existingMap.get(row.id_1c);
    if (!ex) {
      stats.inserted += 1;
    } else if (LOCKED_STATUSES.has(ex.status)) {
      stats.skipped_locked += 1;
    } else if (rowFieldsEqual(row, ex)) {
      stats.unchanged += 1;
    } else {
      stats.updated += 1;
    }
  }

  await pool.query(
    `INSERT INTO exchange_stores_raw (
       id_1c, name, address, legal_entity_1c, manager_1c, manager_name, manager_phone, source_file
     )
     SELECT * FROM UNNEST(
       $1::uuid[], $2::text[], $3::text[], $4::uuid[], $5::uuid[], $6::text[], $7::text[], $8::text[]
     )
     ON CONFLICT (id_1c) DO UPDATE SET
       name = CASE WHEN exchange_stores_raw.status = 'new' THEN EXCLUDED.name ELSE exchange_stores_raw.name END,
       address = CASE WHEN exchange_stores_raw.status = 'new' THEN EXCLUDED.address ELSE exchange_stores_raw.address END,
       legal_entity_1c = CASE WHEN exchange_stores_raw.status = 'new' THEN EXCLUDED.legal_entity_1c ELSE exchange_stores_raw.legal_entity_1c END,
       manager_1c = CASE WHEN exchange_stores_raw.status = 'new' THEN EXCLUDED.manager_1c ELSE exchange_stores_raw.manager_1c END,
       manager_name = CASE WHEN exchange_stores_raw.status = 'new' THEN EXCLUDED.manager_name ELSE exchange_stores_raw.manager_name END,
       manager_phone = CASE WHEN exchange_stores_raw.status = 'new' THEN EXCLUDED.manager_phone ELSE exchange_stores_raw.manager_phone END,
       source_file = EXCLUDED.source_file,
       imported_at = NOW(),
       updated_at = NOW()`,
    [
      rows.map((r) => r.id_1c),
      rows.map((r) => r.name),
      rows.map((r) => r.address),
      rows.map((r) => r.legal_entity_1c),
      rows.map((r) => r.manager_1c),
      rows.map((r) => r.manager_name),
      rows.map((r) => r.manager_phone),
      rows.map(() => sourceFile),
    ],
  );

  return stats;
}

export async function upsertExchangeStoresInBatches(
  pool: PoolLike,
  rows: ExchangeStoreRawRow[],
  sourceFile: string,
  batchSize = 500,
): Promise<UpsertStats> {
  const total: UpsertStats = { inserted: 0, updated: 0, unchanged: 0, skipped_locked: 0 };
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const s = await upsertExchangeStoresBatch(pool, batch, sourceFile);
    total.inserted += s.inserted;
    total.updated += s.updated;
    total.unchanged += s.unchanged;
    total.skipped_locked += s.skipped_locked;
  }
  return total;
}

export type ListQuery = {
  status: ExchangeStoreStatus | "all";
  q: string;
  limit: number;
  offset: number;
};

export function parseExchangeStoresListQuery(req: VercelRequest): ListQuery | { error: string } {
  const statusRaw = String(req.query.status ?? "all").trim().toLowerCase();
  const allowed = new Set(["all", "new", "linked", "ignored", "created"]);
  if (!allowed.has(statusRaw)) {
    return { error: "Некорректный status." };
  }
  const limitParam = Number(req.query.limit ?? 100);
  const offsetParam = Number(req.query.offset ?? 0);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 500) : 100;
  const offset =
    Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
  const q = String(req.query.q ?? "").trim();
  return { status: statusRaw as ListQuery["status"], q, limit, offset };
}

const NORM = (col: string) =>
  `lower(regexp_replace(trim(COALESCE(${col}, '')), '\\\\s+', ' ', 'g'))`;

export async function fetchExchangeStoresList(pool: PoolLike, query: ListQuery) {
  const where: string[] = [];
  const params: unknown[] = [];
  let p = 1;

  if (query.status !== "all") {
    where.push(`esr.status = $${p++}`);
    params.push(query.status);
  }
  if (query.q) {
    where.push(`(esr.name ILIKE $${p} OR esr.address ILIKE $${p})`);
    params.push(`%${query.q}%`);
    p += 1;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countsRes = await pool.query<{ status: ExchangeStoreStatus; n: number }>(
    `SELECT status, COUNT(*)::int AS n FROM exchange_stores_raw GROUP BY status`,
  );
  const counts = { new: 0, linked: 0, ignored: 0, created: 0 };
  for (const r of countsRes.rows) {
    if (r.status in counts) counts[r.status as keyof typeof counts] = r.n;
  }

  const totalRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM exchange_stores_raw esr ${whereSql}`,
    params,
  );
  const total = totalRes.rows[0]?.n ?? 0;

  const listRes = await pool.query<ExchangeStoreListItem>(
    `SELECT
       esr.id_1c,
       esr.name,
       esr.address,
       esr.legal_entity_1c,
       esr.manager_1c,
       esr.manager_name,
       esr.manager_phone,
       esr.status,
       esr.linked_trade_point_id,
       tp.name AS linked_trade_point_name,
       tp.dealer_id AS linked_dealer_id,
       esr.linked_at,
       esr.linked_by,
       esr.imported_at,
       (
         SELECT COUNT(*)::int
         FROM trade_points tp2
         WHERE
           ${NORM("tp2.name")} = ${NORM("esr.name")}
           OR similarity(${NORM("tp2.name")}, ${NORM("esr.name")}) > 0.5
           OR (
             esr.address IS NOT NULL AND tp2.address IS NOT NULL
             AND similarity(${NORM("tp2.address")}, ${NORM("esr.address")}) > 0.4
           )
       ) AS match_candidates_count
     FROM exchange_stores_raw esr
     LEFT JOIN trade_points tp ON tp.id = esr.linked_trade_point_id
     ${whereSql}
     ORDER BY esr.name ASC
     LIMIT $${p} OFFSET $${p + 1}`,
    [...params, query.limit, query.offset],
  );

  return { total, counts, items: listRes.rows };
}

export type MatchCandidate = {
  trade_point_id: string;
  name: string;
  address: string | null;
  dealer_name: string;
  dealer_id: string;
  similarity_name: number;
  similarity_address: number;
  combined_score: number;
};

export async function fetchMatchCandidates(
  pool: PoolLike,
  id1c: string,
): Promise<MatchCandidate[]> {
  const storeRes = await pool.query<{
    name: string;
    address: string | null;
  }>(
    `SELECT name, address FROM exchange_stores_raw WHERE id_1c = $1 LIMIT 1`,
    [id1c],
  );
  const store = storeRes.rows[0];
  if (!store) return [];

  const normName = collapseWs(store.name).toLowerCase();
  const normAddr = store.address ? collapseWs(store.address).toLowerCase() : "";

  const res = await pool.query<MatchCandidate>(
    `SELECT
       tp.id AS trade_point_id,
       tp.name,
       tp.address,
       d.name AS dealer_name,
       d.id AS dealer_id,
       similarity(lower(regexp_replace(trim(tp.name), '\\s+', ' ', 'g')), $1) AS similarity_name,
       CASE
         WHEN $2 = '' OR tp.address IS NULL THEN 0
         ELSE similarity(lower(regexp_replace(trim(tp.address), '\\s+', ' ', 'g')), $2)
       END AS similarity_address,
       (
         similarity(lower(regexp_replace(trim(tp.name), '\\s+', ' ', 'g')), $1) * 0.6
         + CASE
             WHEN $2 = '' OR tp.address IS NULL THEN 0
             ELSE similarity(lower(regexp_replace(trim(tp.address), '\\s+', ' ', 'g')), $2) * 0.4
           END
       ) AS combined_score
     FROM trade_points tp
     INNER JOIN dealers d ON d.id = tp.dealer_id
     WHERE
       lower(regexp_replace(trim(tp.name), '\\s+', ' ', 'g')) = $1
       OR similarity(lower(regexp_replace(trim(tp.name), '\\s+', ' ', 'g')), $1) > 0.5
       OR (
         $2 <> '' AND tp.address IS NOT NULL
         AND similarity(lower(regexp_replace(trim(tp.address), '\\s+', ' ', 'g')), $2) > 0.4
       )
     ORDER BY combined_score DESC
     LIMIT 20`,
    [normName, normAddr],
  );

  return res.rows.map((r) => ({
    ...r,
    similarity_name: Number(r.similarity_name),
    similarity_address: Number(r.similarity_address),
    combined_score: Number(r.combined_score),
  }));
}

export async function searchTradePoints(pool: PoolLike, q: string, limit = 50) {
  const pattern = `%${q}%`;
  const res = await pool.query<{
    trade_point_id: string;
    name: string;
    address: string | null;
    dealer_name: string;
    dealer_id: string;
  }>(
    `SELECT tp.id AS trade_point_id, tp.name, tp.address, d.name AS dealer_name, d.id AS dealer_id
     FROM trade_points tp
     INNER JOIN dealers d ON d.id = tp.dealer_id
     WHERE tp.name ILIKE $1 OR tp.address ILIKE $1 OR d.name ILIKE $1
     ORDER BY tp.name ASC
     LIMIT $2`,
    [pattern, limit],
  );
  return res.rows;
}

export type StoreAction = "link" | "ignore" | "reset" | "create";

export async function applyExchangeStoreAction(
  pool: PoolLike,
  adminId: string,
  id1c: string,
  action: StoreAction,
  tradePointId?: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (action === "create") {
    return { ok: false, code: "NOT_IMPLEMENTED", message: "Создание боевой ТТ пока не реализовано." };
  }

  const cur = await pool.query<{ status: ExchangeStoreStatus }>(
    `SELECT status FROM exchange_stores_raw WHERE id_1c = $1 LIMIT 1`,
    [id1c],
  );
  if (!cur.rows[0]) {
    return { ok: false, code: "NOT_FOUND", message: "Запись не найдена." };
  }

  if (action === "link") {
    if (!tradePointId) {
      return { ok: false, code: "BAD_REQUEST", message: "Для link нужен trade_point_id." };
    }
    const tp = await pool.query<{ id: string }>(
      `SELECT id FROM trade_points WHERE id = $1 LIMIT 1`,
      [tradePointId],
    );
    if (!tp.rows[0]) {
      return { ok: false, code: "NOT_FOUND", message: "Торговая точка не найдена." };
    }
    await pool.query(
      `UPDATE exchange_stores_raw
       SET status = 'linked',
           linked_trade_point_id = $2,
           linked_at = NOW(),
           linked_by = $3,
           updated_at = NOW()
       WHERE id_1c = $1`,
      [id1c, tradePointId, adminId],
    );
    return { ok: true };
  }

  if (action === "ignore") {
    await pool.query(
      `UPDATE exchange_stores_raw
       SET status = 'ignored',
           linked_trade_point_id = NULL,
           linked_at = NULL,
           linked_by = NULL,
           updated_at = NOW()
       WHERE id_1c = $1`,
      [id1c],
    );
    return { ok: true };
  }

  if (action === "reset") {
    const st = cur.rows[0].status;
    if (st === "new") {
      return { ok: false, code: "BAD_REQUEST", message: "Запись уже в статусе new." };
    }
    await pool.query(
      `UPDATE exchange_stores_raw
       SET status = 'new',
           linked_trade_point_id = NULL,
           linked_at = NULL,
           linked_by = NULL,
           updated_at = NOW()
       WHERE id_1c = $1`,
      [id1c],
    );
    return { ok: true };
  }

  return { ok: false, code: "BAD_REQUEST", message: "Неизвестное действие." };
}

export async function autoLinkExchangeStores(pool: PoolLike, adminId: string) {
  const newRows = await pool.query<{ id_1c: string; name: string; address: string | null }>(
    `SELECT id_1c, name, address FROM exchange_stores_raw WHERE status = 'new'`,
  );

  let linked_count = 0;
  let ambiguous_count = 0;
  let unmatched_count = 0;

  for (const row of newRows.rows) {
    const normName = collapseWs(row.name).toLowerCase();
    const normAddr = row.address ? collapseWs(row.address).toLowerCase() : "";

    const candidates = await pool.query<{
      trade_point_id: string;
      similarity_name: number;
      similarity_address: number;
    }>(
      `SELECT
         tp.id AS trade_point_id,
         similarity(lower(regexp_replace(trim(tp.name), '\\s+', ' ', 'g')), $1) AS similarity_name,
         CASE
           WHEN $2 = '' OR tp.address IS NULL THEN 0
           ELSE similarity(lower(regexp_replace(trim(tp.address), '\\s+', ' ', 'g')), $2)
         END AS similarity_address
       FROM trade_points tp
       WHERE
         similarity(lower(regexp_replace(trim(tp.name), '\\s+', ' ', 'g')), $1) >= 0.9
         AND (
           $2 = '' OR tp.address IS NULL
           OR similarity(lower(regexp_replace(trim(tp.address), '\\s+', ' ', 'g')), $2) >= 0.85
         )`,
      [normName, normAddr],
    );

    const strong = candidates.rows.filter(
      (c) =>
        Number(c.similarity_name) >= 0.9 &&
        (normAddr === "" || Number(c.similarity_address) >= 0.85),
    );

    if (strong.length === 1) {
      await pool.query(
        `UPDATE exchange_stores_raw
         SET status = 'linked',
             linked_trade_point_id = $2,
             linked_at = NOW(),
             linked_by = $3,
             updated_at = NOW()
         WHERE id_1c = $1 AND status = 'new'`,
        [row.id_1c, strong[0]!.trade_point_id, adminId],
      );
      linked_count += 1;
    } else if (strong.length > 1) {
      ambiguous_count += 1;
    } else {
      unmatched_count += 1;
    }
  }

  return { linked_count, ambiguous_count, unmatched_count };
}

export async function handleExchangeStoresList(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  const parsed = parseExchangeStoresListQuery(req);
  if ("error" in parsed) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: parsed.error });
    return;
  }
  const data = await fetchExchangeStoresList(pool, parsed);
  sendJson(res, 200, { success: true, ...data });
}

export async function handleExchangeStoresAction(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: DbUserRow,
): Promise<void> {
  const body = (req.body ?? {}) as {
    id_1c?: string;
    action?: string;
    trade_point_id?: string;
  };
  const id1c = String(body.id_1c ?? "").trim();
  const action = String(body.action ?? "").trim() as StoreAction;
  if (!id1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  if (!["link", "ignore", "reset", "create"].includes(action)) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "Неизвестное действие." });
    return;
  }
  if (action === "create") {
    sendJson(res, 501, {
      success: false,
      code: "NOT_IMPLEMENTED",
      message: "Создание боевой ТТ пока не реализовано.",
    });
    return;
  }
  const result = await applyExchangeStoreAction(pool, me.id, id1c, action, body.trade_point_id);
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    sendJson(res, status, { success: false, code: result.code, message: result.message });
    return;
  }
  sendJson(res, 200, { success: true });
}

export async function handleExchangeStoresCandidates(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  const id1c = String(req.query.id_1c ?? "").trim();
  if (!id1c) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "id_1c обязателен." });
    return;
  }
  const storeRes = await pool.query(`SELECT 1 FROM exchange_stores_raw WHERE id_1c = $1 LIMIT 1`, [id1c]);
  if (!storeRes.rows[0]) {
    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Запись не найдена." });
    return;
  }
  const candidates = await fetchMatchCandidates(pool, id1c);
  sendJson(res, 200, { success: true, id_1c: id1c, candidates });
}

export async function handleExchangeStoresAutoLink(
  res: VercelResponse,
  pool: PoolLike,
  me: DbUserRow,
): Promise<void> {
  const result = await autoLinkExchangeStores(pool, me.id);
  sendJson(res, 200, { success: true, ...result });
}

export async function handleSearchTradePoints(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "Минимум 2 символа для поиска." });
    return;
  }
  const items = await searchTradePoints(pool, q);
  sendJson(res, 200, { success: true, items });
}
