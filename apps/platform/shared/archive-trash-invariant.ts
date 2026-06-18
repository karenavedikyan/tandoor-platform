/**
 * Промт 405: взаимное исключение архива (state) и корзины (overrides БД).
 */
import type { PoolLike } from "./admin/admin-auth.js";
import { removeFromArchivedStates } from "./bulk-archive-to-trash-core.js";

/**
 * INVARIANT (промт 405): dealer не может одновременно находиться в:
 *   - dealer_overrides.trashed_at (НЕ NULL, purge_requested_at = NULL)  -- "в корзине"
 *   - state.archivedDealersById[dealerId]                                -- "в архиве"
 *
 * Источник истины:
 *   Корзина → dealer_overrides (БД)
 *   Архив   → state.archivedDealersById у менеджера
 *
 * Любая запись в корзину (single trash, bulk-archive-to-trash) обязана удалить из архива state у всех.
 * Сервер при POST /api/actualization/state дропает архивные ключи, которые уже в корзине БД.
 */

function archiveKeysFromState(state: Record<string, unknown>, field: string): string[] {
  const map = state[field];
  if (!map || typeof map !== "object" || Array.isArray(map)) return [];
  return Object.keys(map as Record<string, unknown>);
}

export async function removeDealerFromArchiveEverywhere(pool: PoolLike, dealerId: string): Promise<void> {
  await removeDealersFromArchiveEverywhere(pool, [dealerId]);
}

export async function removeDealersFromArchiveEverywhere(pool: PoolLike, dealerIds: string[]): Promise<void> {
  await removeFromArchivedStates(pool, dealerIds, "archivedDealersById", null);
}

export async function removeTradePointFromArchiveEverywhere(pool: PoolLike, tradePointId: string): Promise<void> {
  await removeTradePointsFromArchiveEverywhere(pool, [tradePointId]);
}

export async function removeTradePointsFromArchiveEverywhere(pool: PoolLike, tradePointIds: string[]): Promise<void> {
  await removeFromArchivedStates(pool, tradePointIds, "archivedTradePointsById", null);
}

export type StripArchivedTrashResult = {
  state: Record<string, unknown>;
  droppedDealers: number;
  droppedTradePoints: number;
};

export async function stripArchivedKeysAlreadyInActiveTrash(
  pool: PoolLike,
  state: Record<string, unknown>,
): Promise<StripArchivedTrashResult> {
  const dealerKeys = archiveKeysFromState(state, "archivedDealersById");
  const tpKeys = archiveKeysFromState(state, "archivedTradePointsById");
  const next: Record<string, unknown> = { ...state };
  let droppedDealers = 0;
  let droppedTradePoints = 0;

  if (dealerKeys.length > 0) {
    const r = await pool.query<{ dealer_id: string }>(
      `SELECT dealer_id FROM dealer_overrides
       WHERE dealer_id = ANY($1::text[])
         AND trashed_at IS NOT NULL
         AND purge_requested_at IS NULL
         AND purged_at IS NULL`,
      [dealerKeys],
    );
    const inTrash = new Set(r.rows.map((row) => row.dealer_id));
    if (inTrash.size > 0) {
      const arch = { ...(next.archivedDealersById as Record<string, unknown>) };
      for (const id of inTrash) {
        delete arch[id];
        droppedDealers += 1;
      }
      next.archivedDealersById = arch;
    }
  }

  if (tpKeys.length > 0) {
    const r = await pool.query<{ tp_id: string }>(
      `SELECT tp_id FROM trade_point_overrides
       WHERE tp_id = ANY($1::text[])
         AND trashed_at IS NOT NULL
         AND purge_requested_at IS NULL
         AND purged_at IS NULL`,
      [tpKeys],
    );
    const inTrash = new Set(r.rows.map((row) => row.tp_id));
    if (inTrash.size > 0) {
      const arch = { ...(next.archivedTradePointsById as Record<string, unknown>) };
      for (const id of inTrash) {
        delete arch[id];
        droppedTradePoints += 1;
      }
      next.archivedTradePointsById = arch;
    }
  }

  return { state: next, droppedDealers, droppedTradePoints };
}
