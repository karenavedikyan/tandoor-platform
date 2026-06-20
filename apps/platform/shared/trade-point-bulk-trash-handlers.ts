/**
 * Bulk move active trade points → trash (DB single source of truth).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { parseEntityIdArray } from "./parse-entity-id-array.js";
import { canUserTrashTradePoint } from "./dealer-trash-scope-server.js";
import { logTradePointAuditEvent } from "./override-audit-events.js";
import { auditTrashArchiveAction } from "./trash-archive-mutation-guard.js";
import { validateTradePointTrashAllowed } from "./trade-point-primary.js";

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

export async function handleBulkTrashTradePoints(
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
  for (const tpId of ids) {
    const check = await canUserTrashTradePoint(pool, me.id, me.role, tpId);
    if (!check.allowed) {
      skippedIds.push(tpId);
      continue;
    }
    const guard = await validateTradePointTrashAllowed(pool, tpId);
    if (guard) {
      skippedIds.push(tpId);
      continue;
    }
    allowedIds.push(tpId);
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
      `INSERT INTO trade_point_overrides (tp_id, dealer_id, status, is_primary, trashed_at, trashed_by, updated_by)
       SELECT
         src.tp_id,
         src.dealer_id,
         'in_trash'::record_status,
         FALSE,
         NOW(),
         $2::uuid,
         $2::uuid
       FROM (
         SELECT
           x.tp_id,
           COALESCE(
             (SELECT o.dealer_id FROM trade_point_overrides o WHERE o.tp_id = x.tp_id LIMIT 1),
             (SELECT d.external_key
                FROM trade_points tp
                INNER JOIN dealers d ON d.id = tp.dealer_id
               WHERE tp.id::text = x.tp_id OR tp.external_key = x.tp_id
               LIMIT 1)
           ) AS dealer_id
         FROM unnest($1::text[]) AS x(tp_id)
       ) src
       WHERE src.dealer_id IS NOT NULL
       ON CONFLICT (tp_id) DO UPDATE SET
         status = CASE
           WHEN trade_point_overrides.status = 'purged' THEN trade_point_overrides.status
           ELSE 'in_trash'::record_status
         END,
         is_primary = FALSE,
         trashed_at = COALESCE(trade_point_overrides.trashed_at, EXCLUDED.trashed_at),
         trashed_by = COALESCE(trade_point_overrides.trashed_by, EXCLUDED.trashed_by),
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       WHERE trade_point_overrides.status IS DISTINCT FROM 'purged'`,
      [allowedIds, me.id],
    );

    for (const tpId of allowedIds) {
      await logTradePointAuditEvent(pool, {
        tpId,
        eventKind: "trade_point_trash_bulk",
        userId: me.id,
        payload: { bulk: true },
      });
      await auditTrashArchiveAction(pool, me.id, "trade_point_trash_bulk", "trade_point", tpId, {
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
