/**
 * Промт 401: удаление записей корзины из JSON blob actualization state.
 */
import type { PoolLike } from "./admin/admin-auth.js";

function scopeKeyForUser(userId: string): string {
  return `user:${userId}`;
}

function warnBlobTrashRemoval(
  kind: "dealer" | "trade_point",
  userId: string,
  entityId: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[actualization-blob] remove ${kind} from trash blob failed`, {
    userId,
    entityId,
    message: message.slice(0, 200),
  });
}

export async function removeDealerFromActualizationTrashBlob(
  pool: PoolLike,
  userId: string,
  dealerId: string,
): Promise<void> {
  const scopeKey = scopeKeyForUser(userId);
  try {
    await pool.query(
      `UPDATE client_base_actualization_state
         SET state = jsonb_set(
                       state,
                       '{trashedDealersById}',
                       COALESCE(state->'trashedDealersById', '{}'::jsonb) - $2::text,
                       true
                     ),
             updated_at = NOW(),
             version = version + 1
       WHERE (scope_key = $1 OR user_id::text = $3)
         AND jsonb_typeof(state->'trashedDealersById') = 'object'`,
      [scopeKey, dealerId, userId],
    );
  } catch (e) {
    warnBlobTrashRemoval("dealer", userId, dealerId, e);
  }
}

export async function removeTradePointFromActualizationTrashBlob(
  pool: PoolLike,
  userId: string,
  tradePointId: string,
): Promise<void> {
  const scopeKey = scopeKeyForUser(userId);
  try {
    await pool.query(
      `UPDATE client_base_actualization_state
         SET state = jsonb_set(
                       state,
                       '{trashedTradePointsById}',
                       COALESCE(state->'trashedTradePointsById', '{}'::jsonb) - $2::text,
                       true
                     ),
             updated_at = NOW(),
             version = version + 1
       WHERE (scope_key = $1 OR user_id::text = $3)
         AND jsonb_typeof(state->'trashedTradePointsById') = 'object'`,
      [scopeKey, tradePointId, userId],
    );
  } catch (e) {
    warnBlobTrashRemoval("trade_point", userId, tradePointId, e);
  }
}
