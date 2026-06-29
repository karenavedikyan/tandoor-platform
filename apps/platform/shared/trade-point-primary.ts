/**
 * Промт 422: основная ТТ (is_primary) — бизнес-логика trash/set-primary.
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { tpJoinStatusActive } from "./record-status.js";
import { logTradePointAuditEvent } from "./override-audit-events.js";

export type TradePointTrashGuardError = {
  code: "NOT_ACTIVE" | "LAST_TP" | "PRIMARY_TP" | "NOT_FOUND";
  message: string;
};

export type ActiveTpRow = {
  tp_id: string;
  dealer_id: string;
  status: string;
  is_primary: boolean;
};

const LAST_TP_MESSAGE =
  "Нельзя удалить единственную точку клиента. Удалите клиента или сначала создайте ещё одну точку.";
const PRIMARY_TP_MESSAGE = "Сначала назначьте основной другую точку.";

export async function resolveTradePointDealerId(pool: PoolLike, tpId: string): Promise<string | null> {
  const ov = await pool.query<{ dealer_id: string | null }>(
    `SELECT dealer_id FROM trade_point_overrides WHERE tp_id = $1 LIMIT 1`,
    [tpId],
  );
  const fromOverride = ov.rows[0]?.dealer_id?.trim();
  if (fromOverride) return fromOverride;

  const tp = await pool.query<{ dealer_external_key: string }>(
    `SELECT d.external_key AS dealer_external_key
       FROM trade_points tp
       INNER JOIN dealers d ON d.id = tp.dealer_id
      WHERE tp.id::text = $1 OR tp.external_key = $1
      LIMIT 1`,
    [tpId],
  );
  return tp.rows[0]?.dealer_external_key?.trim() ?? null;
}

export async function fetchActiveTradePointOverride(
  pool: PoolLike,
  tpId: string,
): Promise<ActiveTpRow | null> {
  const r = await pool.query<ActiveTpRow>(
    `SELECT tp_id, dealer_id, status::text AS status, is_primary
       FROM trade_point_overrides
      WHERE tp_id = $1
      LIMIT 1`,
    [tpId],
  );
  return r.rows[0] ?? null;
}

/** Активные ТТ клиента: trade_points + overrides (как tpJoinStatusActive). */
export type DealerTradePointListItem = {
  tpId: string;
  name: string | null;
  city: string | null;
};

type UnifiedActiveTpSqlRow = {
  tp_id: string;
  dealer_id: string;
  name: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  comment: string | null;
  showcase_status: string | null;
  format: string | null;
  is_primary: boolean;
  is_override_only: boolean;
  has_override_row: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

/** Полная строка активной ТТ из единого источника (для гидрации actualization-blob). */
export type UnifiedActiveTradePointDetail = {
  tpId: string;
  dealerId: string;
  name: string | null;
  city: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  comment: string | null;
  showcaseStatus: string | null;
  format: string | null;
  isPrimary: boolean;
  /** Нет соответствующей активной trade_points — только override-строка. */
  isOverrideOnly: boolean;
  /** Есть строка trade_point_overrides (правки к release или override-only). */
  hasOverrideRow: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

function mapUnifiedActiveTradePointDetail(row: UnifiedActiveTpSqlRow): UnifiedActiveTradePointDetail {
  return {
    tpId: String(row.tp_id),
    dealerId: String(row.dealer_id),
    name: row.name != null ? String(row.name) : null,
    city: row.city != null ? String(row.city) : null,
    address: row.address != null ? String(row.address) : null,
    contactName: row.contact_name != null ? String(row.contact_name) : null,
    contactPhone: row.contact_phone != null ? String(row.contact_phone) : null,
    comment: row.comment != null ? String(row.comment) : null,
    showcaseStatus: row.showcase_status != null ? String(row.showcase_status) : null,
    format: row.format != null ? String(row.format) : null,
    isPrimary: row.is_primary === true,
    isOverrideOnly: row.is_override_only === true,
    hasOverrideRow: row.has_override_row === true,
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
    updatedBy: row.updated_by != null ? String(row.updated_by) : null,
  };
}

const UNIFIED_ACTIVE_TP_SQL = `SELECT
       tp_id,
       dealer_id,
       name,
       city,
       address,
       contact_name,
       contact_phone,
       comment,
       showcase_status,
       format,
       is_primary,
       is_override_only,
       has_override_row,
       updated_at,
       updated_by
  FROM (
       SELECT COALESCE(tpo.tp_id, tp.external_key, tp.id::text) AS tp_id,
              COALESCE(tpo.dealer_id, d.external_key) AS dealer_id,
              COALESCE(tpo.name, tp.name) AS name,
              COALESCE(tpo.city, tp.city) AS city,
              COALESCE(tpo.address, tp.address) AS address,
              tpo.contact_name,
              tpo.contact_phone,
              tpo.comment,
              tpo.showcase_status,
              COALESCE(tp.format, 'Розница / салон') AS format,
              COALESCE(tpo.is_primary, FALSE) AS is_primary,
              FALSE AS is_override_only,
              (tpo.tp_id IS NOT NULL) AS has_override_row,
              COALESCE(tpo.updated_at, tp.updated_at) AS updated_at,
              tpo.updated_by
         FROM trade_points tp
         INNER JOIN dealers d ON d.id = tp.dealer_id
         LEFT JOIN trade_point_overrides tpo ON (
           tpo.tp_id = tp.id::text OR tpo.tp_id = tp.external_key
         )
        WHERE (d.external_key = $1 OR d.id::text = $1)
          AND tp.is_active = TRUE
          AND ${tpJoinStatusActive("tpo")}
       UNION ALL
       SELECT tpo.tp_id,
              tpo.dealer_id,
              tpo.name,
              tpo.city,
              tpo.address,
              tpo.contact_name,
              tpo.contact_phone,
              tpo.comment,
              tpo.showcase_status,
              'Розница / салон' AS format,
              COALESCE(tpo.is_primary, FALSE) AS is_primary,
              TRUE AS is_override_only,
              TRUE AS has_override_row,
              tpo.updated_at,
              tpo.updated_by
         FROM trade_point_overrides tpo
        WHERE tpo.dealer_id = $1
          AND tpo.status = 'active'
          AND NOT EXISTS (
            SELECT 1
              FROM trade_points tp
              INNER JOIN dealers d ON d.id = tp.dealer_id
             WHERE (d.external_key = $1 OR d.id::text = $1)
               AND tp.is_active = TRUE
               AND (tp.id::text = tpo.tp_id OR tp.external_key = tpo.tp_id)
          )
     ) u
     ORDER BY name ASC NULLS LAST, tp_id ASC`;

/** Активные ТТ клиента с полями для UI (trade_points ∪ override-only). */
export async function listActiveTradePointsForDealerUnifiedDetailed(
  pool: PoolLike,
  dealerId: string,
): Promise<UnifiedActiveTradePointDetail[]> {
  const r = await pool.query<UnifiedActiveTpSqlRow>(UNIFIED_ACTIVE_TP_SQL, [dealerId]);
  return r.rows.map(mapUnifiedActiveTradePointDetail);
}

/** Активные ТТ клиента: trade_points ∪ override-only (единый источник для UI и ответственных). */
export async function listActiveTradePointsForDealerUnified(
  pool: PoolLike,
  dealerId: string,
): Promise<DealerTradePointListItem[]> {
  const rows = await listActiveTradePointsForDealerUnifiedDetailed(pool, dealerId);
  return rows.map((row) => ({
    tpId: row.tpId,
    name: row.name,
    city: row.city,
  }));
}

export async function countActiveTradePointsForDealer(pool: PoolLike, dealerId: string): Promise<number> {
  const r = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
       FROM trade_points tp
       INNER JOIN dealers d ON d.id = tp.dealer_id
       LEFT JOIN trade_point_overrides tpo ON (
         tpo.tp_id = tp.id::text OR tpo.tp_id = tp.external_key
       )
      WHERE (d.external_key = $1 OR d.id::text = $1)
        AND tp.is_active = TRUE
        AND ${tpJoinStatusActive("tpo")}`,
    [dealerId],
  );
  return Number(r.rows[0]?.c ?? 0);
}

export async function listActiveTradePointIdsForDealer(pool: PoolLike, dealerId: string): Promise<string[]> {
  const r = await pool.query<{ tp_id: string }>(
    `SELECT COALESCE(tpo.tp_id, tp.external_key, tp.id::text) AS tp_id
       FROM trade_points tp
       INNER JOIN dealers d ON d.id = tp.dealer_id
       LEFT JOIN trade_point_overrides tpo ON (
         tpo.tp_id = tp.id::text OR tpo.tp_id = tp.external_key
       )
      WHERE (d.external_key = $1 OR d.id::text = $1)
        AND tp.is_active = TRUE
        AND ${tpJoinStatusActive("tpo")}
      ORDER BY COALESCE(tpo.created_at, tp.created_at) ASC, tp.external_key ASC`,
    [dealerId],
  );
  return r.rows.map((row) => row.tp_id);
}

export async function dealerHasPrimaryAmongActive(pool: PoolLike, dealerId: string): Promise<boolean> {
  const r = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c
       FROM trade_point_overrides tpo
      WHERE tpo.dealer_id = $1
        AND tpo.status = 'active'
        AND tpo.is_primary = TRUE`,
    [dealerId],
  );
  return Number(r.rows[0]?.c ?? 0) > 0;
}

export async function validateTradePointTrashAllowed(
  pool: PoolLike,
  tpId: string,
): Promise<TradePointTrashGuardError | null> {
  const row = await fetchActiveTradePointOverride(pool, tpId);
  const dealerId = row?.dealer_id?.trim() ?? (await resolveTradePointDealerId(pool, tpId));
  if (!dealerId) {
    return { code: "NOT_FOUND", message: "Торговая точка не найдена." };
  }

  if (row && row.status !== "active") {
    return { code: "NOT_ACTIVE", message: "Торговая точка не активна." };
  }

  const activeCount = await countActiveTradePointsForDealer(pool, dealerId);
  if (activeCount <= 1) {
    return { code: "LAST_TP", message: LAST_TP_MESSAGE };
  }

  const isPrimary =
    row?.is_primary === true ||
    (await pool.query<{ is_primary: boolean }>(
      `SELECT is_primary FROM trade_point_overrides WHERE tp_id = $1 AND status = 'active' LIMIT 1`,
      [tpId],
    )).rows[0]?.is_primary === true;

  if (isPrimary) {
    return { code: "PRIMARY_TP", message: PRIMARY_TP_MESSAGE };
  }

  return null;
}

export async function autoPromoteSolePrimaryForDealer(
  pool: PoolLike,
  dealerId: string,
  userId: string,
): Promise<void> {
  const activeIds = await listActiveTradePointIdsForDealer(pool, dealerId);
  if (activeIds.length !== 1) return;
  const soleId = activeIds[0]!;
  await pool.query(
    `UPDATE trade_point_overrides
     SET is_primary = false, updated_at = NOW(), updated_by = $2::uuid
     WHERE dealer_id = $1 AND status = 'active'`,
    [dealerId, userId],
  );
  await pool.query(
    `INSERT INTO trade_point_overrides (tp_id, dealer_id, status, is_primary, updated_by)
     VALUES ($1, $2, 'active', TRUE, $3::uuid)
     ON CONFLICT (tp_id) DO UPDATE SET
       is_primary = TRUE,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [soleId, dealerId, userId],
  );
}

export async function ensurePrimaryOnUntrash(
  pool: PoolLike,
  dealerId: string,
  tpId: string,
  userId: string,
): Promise<void> {
  const hasPrimary = await dealerHasPrimaryAmongActive(pool, dealerId);
  if (hasPrimary) return;
  await pool.query(
    `INSERT INTO trade_point_overrides (tp_id, dealer_id, status, is_primary, updated_by)
     VALUES ($1, $2, 'active', TRUE, $3::uuid)
     ON CONFLICT (tp_id) DO UPDATE SET
       is_primary = TRUE,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by`,
    [tpId, dealerId, userId],
  );
}

export async function setPrimaryTradePointInTransaction(
  pool: PoolLike,
  tpId: string,
  userId: string,
): Promise<{ dealerId: string } | TradePointTrashGuardError> {
  const row = await fetchActiveTradePointOverride(pool, tpId);
  if (!row || row.status !== "active") {
    return { code: "NOT_ACTIVE", message: "Торговая точка не активна." };
  }
  const dealerId = row.dealer_id?.trim();
  if (!dealerId) {
    return { code: "NOT_FOUND", message: "У торговой точки не указан клиент." };
  }

  await pool.query("BEGIN");
  try {
    await pool.query(
      `UPDATE trade_point_overrides
       SET is_primary = false, updated_at = NOW(), updated_by = $2::uuid
       WHERE dealer_id = $1 AND status = 'active'`,
      [dealerId, userId],
    );
    await pool.query(
      `UPDATE trade_point_overrides
       SET is_primary = true, updated_at = NOW(), updated_by = $2::uuid
       WHERE tp_id = $1 AND status = 'active'`,
      [tpId, userId],
    );
    await logTradePointAuditEvent(pool, {
      tpId,
      eventKind: "tp_set_primary",
      userId,
      payload: { dealer_id: dealerId },
    });
    await pool.query("COMMIT");
    return { dealerId };
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

export { LAST_TP_MESSAGE, PRIMARY_TP_MESSAGE };
