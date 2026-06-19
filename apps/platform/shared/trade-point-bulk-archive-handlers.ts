/**
 * Промт 403: bulk move archived trade points → trash (сервер).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import {
  buildTradePointTrashEntries,
  countArchivedByOwner,
  excludePurgePendingIds,
  fetchActorDisplayName,
  filterArchivedIdsForBulkMove,
  mergeTrashIntoInitiatorState,
  parseEntityIdArray,
  removeFromArchivedStates,
  resolveArchiveScopeUserIds,
} from "./bulk-archive-to-trash-core.js";
import { logTradePointAuditEvent } from "./override-audit-events.js";
import { auditTrashArchiveAction } from "./trash-archive-mutation-guard.js";

type SessionUser = { id: string; role: string; status: string };

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function assertActiveUser(me: SessionUser, res: VercelResponse): boolean {
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return false;
  }
  return true;
}

export async function handleBulkMoveArchiveToTrash(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;

  const ids = parseEntityIdArray(req.body, "trade_point_ids");
  if (ids.length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Передайте trade_point_ids." });
    return;
  }

  const inArchiveScope = await filterArchivedIdsForBulkMove(pool, me, ids, "archivedTradePointsById");
  const purgePending = await excludePurgePendingIds(pool, inArchiveScope, "trade_point_overrides", "tp_id");
  const allowedIds = inArchiveScope.filter((id) => !purgePending.has(id));

  const skippedIds = ids.filter((id) => !allowedIds.includes(id));
  if (allowedIds.length === 0) {
    sendJson(res, 200, {
      success: true,
      data: { moved: 0, skipped: ids.length, skippedIds },
    });
    return;
  }

  const scopeUserIds = await resolveArchiveScopeUserIds(pool, me);
  const actorName = await fetchActorDisplayName(pool, me.id);
  const byOwner = await countArchivedByOwner(pool, allowedIds, "archivedTradePointsById");

  await pool.query("BEGIN");
  try {
    await pool.query(
      `INSERT INTO trade_point_overrides (tp_id, status, trashed_at, trashed_by, updated_by)
       SELECT unnest($1::text[]), 'in_trash'::record_status, NOW(), $2::uuid, $2::uuid
       ON CONFLICT (tp_id) DO UPDATE
         SET status = CASE
               WHEN trade_point_overrides.status = 'purged' THEN trade_point_overrides.status
               ELSE 'in_trash'::record_status
             END,
             trashed_at = COALESCE(trade_point_overrides.trashed_at, EXCLUDED.trashed_at),
             trashed_by = COALESCE(trade_point_overrides.trashed_by, EXCLUDED.trashed_by),
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by
       WHERE trade_point_overrides.status IS DISTINCT FROM 'purged'`,
      [allowedIds, me.id],
    );

    await removeFromArchivedStates(pool, allowedIds, "archivedTradePointsById", scopeUserIds);

    const trashEntries = await buildTradePointTrashEntries(pool, allowedIds, me, actorName);
    await mergeTrashIntoInitiatorState(pool, me, "trashedTradePointsById", trashEntries);

    for (const tpId of allowedIds) {
      await logTradePointAuditEvent(pool, {
        tpId,
        eventKind: "tp_archive_to_trash_bulk",
        userId: me.id,
      });
      await auditTrashArchiveAction(pool, me.id, "tp_archive_to_trash_bulk", "trade_point", tpId, {
        bulk: true,
      });
    }

    await pool.query("COMMIT");
    sendJson(res, 200, {
      success: true,
      data: {
        moved: allowedIds.length,
        skipped: skippedIds.length,
        ...(skippedIds.length > 0 ? { skippedIds } : {}),
        byOwner,
      },
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}
