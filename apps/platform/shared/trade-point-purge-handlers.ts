/**
 * Двухуровневая корзина торговых точек (Промт 386).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { removeTradePointFromArchiveEverywhere } from "./archive-trash-invariant.js";
import { canUserTrashTradePoint } from "./dealer-trash-scope-server.js";
import { mapTradePointOverrideRow, type TradePointOverrideRow } from "./trade-point-overrides-types.js";
import {
  isEmployeeTrashStatus,
  isPendingAdminStatus,
  isPurgedStatus,
  parseRecordStatus,
} from "./record-status.js";
import { logTradePointAuditEvent } from "./override-audit-events.js";
import { removeTradePointFromActualizationTrashBlob } from "./actualization-blob-trash.js";
import { runOverridesHandlerSafe } from "./overrides-write-errors.js";
import { roleHasPermission } from "./auth-rbac.js";
import type { UserRole } from "./auth.js";

type SessionUser = { id: string; role: string; status: string };

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function parseTpId(req: VercelRequest): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return typeof body.tp_id === "string" ? body.tp_id.trim() : "";
}

function parseRestoreTarget(req: VercelRequest): "employee_trash" | "active" {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return body.target === "active" ? "active" : "employee_trash";
}

async function fetchOverride(pool: PoolLike, tpId: string): Promise<TradePointOverrideRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM trade_point_overrides WHERE tp_id = $1 LIMIT 1`,
    [tpId],
  );
  return r.rows[0] ? mapTradePointOverrideRow(r.rows[0]) : null;
}

function isEmployeeTrash(ov: TradePointOverrideRow | null): boolean {
  return isEmployeeTrashStatus(parseRecordStatus(ov?.status));
}

function isAdminQueue(ov: TradePointOverrideRow | null): boolean {
  return isPendingAdminStatus(parseRecordStatus(ov?.status));
}

function isPurged(ov: TradePointOverrideRow | null): boolean {
  return isPurgedStatus(parseRecordStatus(ov?.status));
}

function assertActiveUser(me: SessionUser, res: VercelResponse): boolean {
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return false;
  }
  return true;
}

function hasPurgePermission(role: UserRole): boolean {
  return roleHasPermission(role, "admin.purge_dealer");
}

export async function handleTradePointOverridesRequestPurge(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const tpId = parseTpId(req);
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  const ov = await fetchOverride(pool, tpId);
  if (!isEmployeeTrash(ov)) {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись не в корзине сотрудника." });
    return;
  }
  const check = await canUserTrashTradePoint(pool, me.id, me.role, tpId);
  if (!check.allowed) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN_OUT_OF_SCOPE", message: "Вне зоны ответственности." });
    return;
  }
  await runOverridesHandlerSafe(pool, "tp_purge_request", tpId, { tp_id: tpId }, me.id, async () => {
    await pool.query(
      `UPDATE trade_point_overrides
       SET status = 'pending_admin',
           purge_requested_at = NOW(), purge_requested_by = $2::uuid,
           updated_at = NOW(), updated_by = $2::uuid
       WHERE tp_id = $1 AND status = 'in_trash'`,
      [tpId, me.id],
    );
    await logTradePointAuditEvent(pool, { tpId, eventKind: "tp_purge_requested", userId: me.id });
  });
  await removeTradePointFromActualizationTrashBlob(pool, me.id, tpId);
  sendJson(res, 200, { success: true, data: { override: await fetchOverride(pool, tpId) } });
}

export async function handleTradePointOverridesRestore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const tpId = parseTpId(req);
  const target = parseRestoreTarget(req);
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  const ov = await fetchOverride(pool, tpId);
  if (isPurged(ov)) {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись soft-deleted." });
    return;
  }
  if (isAdminQueue(ov)) {
    if (!hasPurgePermission(me.role as UserRole)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin/director." });
      return;
    }
    await runOverridesHandlerSafe(pool, "tp_restore", tpId, { tp_id: tpId, target }, me.id, async () => {
      if (target === "active") {
        await pool.query(
          `UPDATE trade_point_overrides
           SET status = 'active',
               trashed_at = NULL, trashed_by = NULL, purge_requested_at = NULL, purge_requested_by = NULL,
               updated_at = NOW(), updated_by = $2::uuid
           WHERE tp_id = $1 AND status IN ('in_trash', 'pending_admin')`,
          [tpId, me.id],
        );
        await logTradePointAuditEvent(pool, { tpId, eventKind: "tp_restored_to_active", userId: me.id });
        await removeTradePointFromArchiveEverywhere(pool, tpId);
      } else {
        await pool.query(
          `UPDATE trade_point_overrides
           SET status = 'in_trash',
               purge_requested_at = NULL, purge_requested_by = NULL,
               updated_at = NOW(), updated_by = $2::uuid
           WHERE tp_id = $1 AND status = 'pending_admin'`,
          [tpId, me.id],
        );
        await logTradePointAuditEvent(pool, { tpId, eventKind: "tp_restored_to_employee_trash", userId: me.id });
      }
    });
  } else if (isEmployeeTrash(ov)) {
    const check = await canUserTrashTradePoint(pool, me.id, me.role, tpId);
    if (!check.allowed) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN_OUT_OF_SCOPE", message: "Вне зоны ответственности." });
      return;
    }
    await runOverridesHandlerSafe(pool, "tp_restore_active", tpId, { tp_id: tpId }, me.id, async () => {
      await pool.query(
        `UPDATE trade_point_overrides
         SET status = 'active',
             trashed_at = NULL, trashed_by = NULL, purge_requested_at = NULL, purge_requested_by = NULL,
             updated_at = NOW(), updated_by = $2::uuid
         WHERE tp_id = $1 AND status IN ('in_trash', 'pending_admin')`,
        [tpId, me.id],
      );
      await logTradePointAuditEvent(pool, { tpId, eventKind: "tp_restored_to_active", userId: me.id });
      await removeTradePointFromArchiveEverywhere(pool, tpId);
    });
  } else {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись не в корзине." });
    return;
  }
  sendJson(res, 200, { success: true, data: { override: await fetchOverride(pool, tpId) } });
}

export async function handleTradePointOverridesPurge(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  if (!hasPurgePermission(me.role as UserRole)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin/director." });
    return;
  }
  const tpId = parseTpId(req);
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  const ov = await fetchOverride(pool, tpId);
  if (!isAdminQueue(ov)) {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись не в корзине админа." });
    return;
  }
  await runOverridesHandlerSafe(pool, "tp_purge", tpId, { tp_id: tpId }, me.id, async () => {
    await pool.query(
      `UPDATE trade_point_overrides
       SET status = 'purged',
           purged_at = NOW(), purged_by = $2::uuid,
           updated_at = NOW(), updated_by = $2::uuid
       WHERE tp_id = $1 AND status = 'pending_admin'`,
      [tpId, me.id],
    );
    await logTradePointAuditEvent(pool, { tpId, eventKind: "tp_purged", userId: me.id });
  });
  sendJson(res, 200, { success: true, data: { override: await fetchOverride(pool, tpId) } });
}

export async function handleTradePointOverridesAdminRestore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  if (!hasPurgePermission(me.role as UserRole)) {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin/director." });
    return;
  }
  const tpId = parseTpId(req);
  if (!tpId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите tp_id." });
    return;
  }
  const ov = await fetchOverride(pool, tpId);
  if (!isPurged(ov)) {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись не soft-deleted." });
    return;
  }
  await runOverridesHandlerSafe(pool, "tp_admin_restore", tpId, { tp_id: tpId }, me.id, async () => {
    await pool.query(
      `UPDATE trade_point_overrides
       SET status = 'pending_admin',
           purged_at = NULL, purged_by = NULL,
           updated_at = NOW(), updated_by = $2::uuid
       WHERE tp_id = $1 AND status = 'purged'`,
      [tpId, me.id],
    );
    await logTradePointAuditEvent(pool, { tpId, eventKind: "tp_admin_restored", userId: me.id });
  });
  sendJson(res, 200, { success: true, data: { override: await fetchOverride(pool, tpId) } });
}
