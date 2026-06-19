/**
 * Промт 420: bulk move active dealers → trash (DB single source of truth).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { parseEntityIdArray } from "./parse-entity-id-array.js";
import { canUserTrashDealer } from "./dealer-trash-scope-server.js";
import { logDealerAuditEvent } from "./override-audit-events.js";
import { auditTrashArchiveAction } from "./trash-archive-mutation-guard.js";
import { cascadeDealersTradePointsToTrash } from "./record-status-cascade.js";

type SessionUser = { id: string; role: string; status: string };

const BULK_TRASH_MAX_IDS = 200;

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

export async function handleBulkTrashDealers(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;

  const ids = parseEntityIdArray(req.body, "dealer_ids");
  if (ids.length === 0) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Передайте dealer_ids." });
    return;
  }
  if (ids.length > BULK_TRASH_MAX_IDS) {
    sendJson(res, 400, {
      success: false,
      code: "VALIDATION_ERROR",
      message: `Не более ${BULK_TRASH_MAX_IDS} ID за запрос.`,
    });
    return;
  }

  const allowedIds: string[] = [];
  const skippedIds: string[] = [];
  for (const dealerId of ids) {
    const check = await canUserTrashDealer(pool, me.id, me.role, dealerId);
    if (check.allowed) allowedIds.push(dealerId);
    else skippedIds.push(dealerId);
  }

  if (allowedIds.length === 0) {
    sendJson(res, 200, {
      success: true,
      data: { moved: 0, skipped: skippedIds.length, skippedIds },
    });
    return;
  }

  await pool.query("BEGIN");
  try {
    await pool.query(
      `INSERT INTO dealer_overrides (dealer_id, status, trashed_at, trashed_by, updated_by)
       SELECT unnest($1::text[]), 'in_trash'::record_status, NOW(), $2::uuid, $2::uuid
       ON CONFLICT (dealer_id) DO UPDATE
         SET status = CASE
               WHEN dealer_overrides.status = 'purged' THEN dealer_overrides.status
               ELSE 'in_trash'::record_status
             END,
             trashed_at = COALESCE(dealer_overrides.trashed_at, EXCLUDED.trashed_at),
             trashed_by = COALESCE(dealer_overrides.trashed_by, EXCLUDED.trashed_by),
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by
       WHERE dealer_overrides.status IS DISTINCT FROM 'purged'`,
      [allowedIds, me.id],
    );

    await cascadeDealersTradePointsToTrash(pool, allowedIds, me.id);

    for (const dealerId of allowedIds) {
      await logDealerAuditEvent(pool, {
        dealerId,
        eventKind: "dealer_trash_bulk",
        userId: me.id,
      });
      await auditTrashArchiveAction(pool, me.id, "dealer_trash_bulk", "dealer", dealerId, {
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
      },
    });
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}
