/**
 * Промт 404: bulk restore / request-purge в корзине.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { parseEntityIdArray } from "./bulk-archive-to-trash-core.js";
import {
  removeDealerFromActualizationTrashBlob,
  removeTradePointFromActualizationTrashBlob,
} from "./actualization-blob-trash.js";
import { logDealerAuditEvent, logTradePointAuditEvent } from "./override-audit-events.js";
import {
  removeDealersFromArchiveEverywhere,
  removeTradePointsFromArchiveEverywhere,
} from "./archive-trash-invariant.js";
import {
  BULK_TRASH_MAX_IDS,
  chunkIds,
  filterTrashedDealerIdsForBulk,
  filterTrashedDealerIdsForPurge,
  filterTrashedTradePointIdsForBulk,
  filterTrashedTradePointIdsForPurge,
  logBulkTrashAudit,
  removeDealersFromInitiatorTrashBlob,
  removeTradePointsFromInitiatorTrashBlob,
} from "./trash-bulk-actions-core.js";

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

function parseIds(req: VercelRequest, field: string, res: VercelResponse): string[] | null {
  const ids = parseEntityIdArray(req.body, field);
  if (ids.length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: `Передайте ${field}.` });
    return null;
  }
  if (ids.length > BULK_TRASH_MAX_IDS) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: `Не более ${BULK_TRASH_MAX_IDS} ID за запрос.`,
    });
    return null;
  }
  return ids;
}

export async function handleBulkRestoreDealers(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const ids = parseIds(req, "dealer_ids", res);
  if (!ids) return;

  const { allowed, skipped, skippedIds } = await filterTrashedDealerIdsForBulk(pool, me, ids);
  if (allowed.length === 0) {
    sendJson(res, 200, { success: true, data: { restored: 0, skipped: ids.length, skippedIds } });
    return;
  }

  await pool.query("BEGIN");
  try {
    for (const chunk of chunkIds(allowed)) {
      await pool.query(
        `UPDATE dealer_overrides
            SET status = 'active',
                trashed_at = NULL,
                trashed_by = NULL,
                purge_requested_at = NULL,
                purge_requested_by = NULL,
                updated_at = NOW(),
                updated_by = $2::uuid
          WHERE dealer_id = ANY($1::text[])
            AND status IN ('in_trash', 'pending_admin')`,
        [chunk, me.id],
      );
    }

    await removeDealersFromInitiatorTrashBlob(pool, me.id, allowed);
    await removeDealersFromArchiveEverywhere(pool, allowed);

    for (const dealerId of allowed) {
      await logDealerAuditEvent(pool, {
        dealerId,
        eventKind: "dealer_trash_restore_bulk",
        userId: me.id,
      });
    }
    await logBulkTrashAudit(pool, me.id, "dealer_trash_restore_bulk", "dealer", allowed);

    await pool.query("COMMIT");
    sendJson(res, 200, {
      success: true,
      data: {
        restored: allowed.length,
        skipped,
        ...(skipped > 0 ? { skippedIds } : {}),
      },
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

export async function handleBulkRequestPurgeDealers(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const ids = parseIds(req, "dealer_ids", res);
  if (!ids) return;

  const { allowed, skipped, skippedIds } = await filterTrashedDealerIdsForPurge(pool, me, ids);
  if (allowed.length === 0) {
    sendJson(res, 200, { success: true, data: { requestedPurge: 0, skipped: ids.length, skippedIds } });
    return;
  }

  await pool.query("BEGIN");
  try {
    for (const chunk of chunkIds(allowed)) {
      await pool.query(
        `UPDATE dealer_overrides
            SET status = 'pending_admin',
                purge_requested_at = NOW(),
                purge_requested_by = $2::uuid,
                updated_at = NOW(),
                updated_by = $2::uuid
          WHERE dealer_id = ANY($1::text[])
            AND status = 'in_trash'`,
        [chunk, me.id],
      );
    }

    await removeDealersFromInitiatorTrashBlob(pool, me.id, allowed);
    for (const dealerId of allowed) {
      await removeDealerFromActualizationTrashBlob(pool, me.id, dealerId);
      await logDealerAuditEvent(pool, {
        dealerId,
        eventKind: "dealer_trash_request_purge_bulk",
        userId: me.id,
      });
    }
    await logBulkTrashAudit(pool, me.id, "dealer_trash_request_purge_bulk", "dealer", allowed);

    await pool.query("COMMIT");
    sendJson(res, 200, {
      success: true,
      data: {
        requestedPurge: allowed.length,
        skipped,
        ...(skipped > 0 ? { skippedIds } : {}),
      },
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

export async function handleBulkRestoreTradePoints(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const ids = parseIds(req, "trade_point_ids", res);
  if (!ids) return;

  const { allowed, skipped, skippedIds } = await filterTrashedTradePointIdsForBulk(pool, me, ids);
  if (allowed.length === 0) {
    sendJson(res, 200, { success: true, data: { restored: 0, skipped: ids.length, skippedIds } });
    return;
  }

  await pool.query("BEGIN");
  try {
    for (const chunk of chunkIds(allowed)) {
      await pool.query(
        `UPDATE trade_point_overrides
            SET status = 'active',
                trashed_at = NULL,
                trashed_by = NULL,
                purge_requested_at = NULL,
                purge_requested_by = NULL,
                updated_at = NOW(),
                updated_by = $2::uuid
          WHERE tp_id = ANY($1::text[])
            AND status IN ('in_trash', 'pending_admin')`,
        [chunk, me.id],
      );
    }

    await removeTradePointsFromInitiatorTrashBlob(pool, me.id, allowed);
    await removeTradePointsFromArchiveEverywhere(pool, allowed);

    for (const tpId of allowed) {
      await logTradePointAuditEvent(pool, {
        tpId,
        eventKind: "tp_trash_restore_bulk",
        userId: me.id,
      });
    }
    await logBulkTrashAudit(pool, me.id, "tp_trash_restore_bulk", "trade_point", allowed);

    await pool.query("COMMIT");
    sendJson(res, 200, {
      success: true,
      data: {
        restored: allowed.length,
        skipped,
        ...(skipped > 0 ? { skippedIds } : {}),
      },
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

export async function handleBulkRequestPurgeTradePoints(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const ids = parseIds(req, "trade_point_ids", res);
  if (!ids) return;

  const { allowed, skipped, skippedIds } = await filterTrashedTradePointIdsForPurge(pool, me, ids);
  if (allowed.length === 0) {
    sendJson(res, 200, { success: true, data: { requestedPurge: 0, skipped: ids.length, skippedIds } });
    return;
  }

  await pool.query("BEGIN");
  try {
    for (const chunk of chunkIds(allowed)) {
      await pool.query(
        `UPDATE trade_point_overrides
            SET status = 'pending_admin',
                purge_requested_at = NOW(),
                purge_requested_by = $2::uuid,
                updated_at = NOW(),
                updated_by = $2::uuid
          WHERE tp_id = ANY($1::text[])
            AND status = 'in_trash'`,
        [chunk, me.id],
      );
    }

    await removeTradePointsFromInitiatorTrashBlob(pool, me.id, allowed);
    for (const tpId of allowed) {
      await removeTradePointFromActualizationTrashBlob(pool, me.id, tpId);
      await logTradePointAuditEvent(pool, {
        tpId,
        eventKind: "tp_trash_request_purge_bulk",
        userId: me.id,
      });
    }
    await logBulkTrashAudit(pool, me.id, "tp_trash_request_purge_bulk", "trade_point", allowed);

    await pool.query("COMMIT");
    sendJson(res, 200, {
      success: true,
      data: {
        requestedPurge: allowed.length,
        skipped,
        ...(skipped > 0 ? { skippedIds } : {}),
      },
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}
