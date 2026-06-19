/**
 * Промт 418: каскад status dealer → trade_point_overrides при trash/restore/purge.
 */

import type { PoolLike } from "./admin/admin-auth.js";

const nowIso = () => new Date().toISOString();

/** active → in_trash: все активные ТТ клиента уходят в корзину того же пользователя. */
export async function cascadeDealerTradePointsToTrash(
  pool: PoolLike,
  dealerId: string,
  userId: string,
  trashedAt = nowIso(),
): Promise<void> {
  await pool.query(
    `INSERT INTO trade_point_overrides (tp_id, status, trashed_at, trashed_by, updated_by)
     SELECT tp.id, 'in_trash'::record_status, $2::timestamptz, $3::uuid, $3::uuid
     FROM trade_points tp
     LEFT JOIN trade_point_overrides tpo ON tpo.tp_id = tp.id
     WHERE tp.dealer_id = $1::uuid
       AND tp.is_active = TRUE
       AND (tpo.tp_id IS NULL OR tpo.status = 'active')
     ON CONFLICT (tp_id) DO UPDATE SET
       status = CASE
         WHEN trade_point_overrides.status = 'purged' THEN trade_point_overrides.status
         ELSE 'in_trash'::record_status
       END,
       trashed_at = EXCLUDED.trashed_at,
       trashed_by = EXCLUDED.trashed_by,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by
     WHERE trade_point_overrides.status IS DISTINCT FROM 'purged'`,
    [dealerId, trashedAt, userId],
  );
}

/** in_trash → active: только ТТ, попавшие в корзину этим же удалением. */
export async function cascadeDealerTradePointsToActive(
  pool: PoolLike,
  dealerId: string,
  restoringUserId: string,
): Promise<void> {
  await pool.query(
    `UPDATE trade_point_overrides tpo
     SET status = 'active',
         trashed_at = NULL,
         trashed_by = NULL,
         purge_requested_at = NULL,
         purge_requested_by = NULL,
         updated_at = NOW(),
         updated_by = $3::uuid
     FROM trade_points tp
     WHERE tp.id = tpo.tp_id
       AND tp.dealer_id = $1::uuid
       AND tpo.status = 'in_trash'
       AND tpo.trashed_by = $2::uuid`,
    [dealerId, restoringUserId, restoringUserId],
  );
}

/** in_trash → pending_admin (purge_request). */
export async function cascadeDealerTradePointsToPendingAdmin(
  pool: PoolLike,
  dealerId: string,
  userId: string,
): Promise<void> {
  await pool.query(
    `UPDATE trade_point_overrides tpo
     SET status = 'pending_admin',
         purge_requested_at = NOW(),
         purge_requested_by = $3::uuid,
         updated_at = NOW(),
         updated_by = $3::uuid
     FROM trade_points tp
     WHERE tp.id = tpo.tp_id
       AND tp.dealer_id = $1::uuid
       AND tpo.status = 'in_trash'
       AND tpo.trashed_by = $2::uuid`,
    [dealerId, userId, userId],
  );
}

/** pending_admin → purged (admin purge). */
export async function cascadeDealerTradePointsToPurged(
  pool: PoolLike,
  dealerId: string,
  userId: string,
): Promise<void> {
  await pool.query(
    `UPDATE trade_point_overrides tpo
     SET status = 'purged',
         purged_at = NOW(),
         purged_by = $3::uuid,
         updated_at = NOW(),
         updated_by = $3::uuid
     FROM trade_points tp
     WHERE tp.id = tpo.tp_id
       AND tp.dealer_id = $1::uuid
       AND tpo.status = 'pending_admin'`,
    [dealerId, userId, userId],
  );
}

/** pending_admin → in_trash (restore to employee trash). */
export async function cascadeDealerTradePointsToEmployeeTrash(
  pool: PoolLike,
  dealerId: string,
  userId: string,
): Promise<void> {
  await pool.query(
    `UPDATE trade_point_overrides tpo
     SET status = 'in_trash',
         purge_requested_at = NULL,
         purge_requested_by = NULL,
         updated_at = NOW(),
         updated_by = $3::uuid
     FROM trade_points tp
     WHERE tp.id = tpo.tp_id
       AND tp.dealer_id = $1::uuid
       AND tpo.status = 'pending_admin'`,
    [dealerId, userId, userId],
  );
}

/** Bulk trash: каскад для нескольких dealer_id. */
export async function cascadeDealersTradePointsToTrash(
  pool: PoolLike,
  dealerIds: string[],
  userId: string,
): Promise<void> {
  if (dealerIds.length === 0) return;
  const trashedAt = nowIso();
  for (const dealerId of dealerIds) {
    await cascadeDealerTradePointsToTrash(pool, dealerId, userId, trashedAt);
  }
}
