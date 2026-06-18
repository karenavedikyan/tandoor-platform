/**
 * Двухуровневая корзина дилеров (Промт 386).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { canUserTrashDealer } from "./dealer-trash-scope-server.js";
import { mapDealerOverrideRow, type DealerOverrideRow } from "./dealer-overrides-types.js";
import { logDealerAuditEvent } from "./override-audit-events.js";
import { removeDealerFromActualizationTrashBlob } from "./actualization-blob-trash.js";
import { runOverridesHandlerSafe } from "./overrides-write-errors.js";
import { roleHasPermission } from "./auth-rbac.js";
import type { UserRole } from "./auth.js";

type SessionUser = { id: string; role: string; status: string };

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

function parseDealerId(req: VercelRequest): string {
  const body = (req.body ?? {}) as Record<string, unknown>;
  return typeof body.dealer_id === "string" ? body.dealer_id.trim() : "";
}

function parseRestoreTarget(req: VercelRequest): "employee_trash" | "active" {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const t = body.target;
  return t === "active" ? "active" : "employee_trash";
}

async function fetchOverride(pool: PoolLike, dealerId: string): Promise<DealerOverrideRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM dealer_overrides WHERE dealer_id = $1 LIMIT 1`,
    [dealerId],
  );
  return r.rows[0] ? mapDealerOverrideRow(r.rows[0]) : null;
}

function isEmployeeTrash(ov: DealerOverrideRow | null): boolean {
  return Boolean(ov?.trashed_at && !ov.purge_requested_at && !ov.purged_at);
}

function isAdminQueue(ov: DealerOverrideRow | null): boolean {
  return Boolean(ov?.purge_requested_at && !ov.purged_at);
}

function isPurged(ov: DealerOverrideRow | null): boolean {
  return Boolean(ov?.purged_at);
}

function assertActiveUser(me: SessionUser, res: VercelResponse): boolean {
  if (me.status !== "active") {
    sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
    return false;
  }
  return true;
}

function isAdminDirector(role: string): boolean {
  return role === "admin" || role === "director";
}

function hasPurgePermission(role: UserRole): boolean {
  return roleHasPermission(role, "admin.purge_dealer");
}

export async function handleDealerOverridesRequestPurge(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const dealerId = parseDealerId(req);
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }

  const ov = await fetchOverride(pool, dealerId);
  if (!isEmployeeTrash(ov)) {
    sendJson(res, 409, {
      success: false,
      code: "INVALID_STATE",
      message: "Запись не в корзине сотрудника.",
    });
    return;
  }

  const check = await canUserTrashDealer(pool, me.id, me.role, dealerId);
  if (!check.allowed) {
    sendJson(res, 403, {
      success: false,
      code: "FORBIDDEN_OUT_OF_SCOPE",
      message: "Этот клиент вне вашей зоны ответственности.",
    });
    return;
  }

  await runOverridesHandlerSafe(
    pool,
    "dealer_purge_request",
    dealerId,
    { dealer_id: dealerId },
    me.id,
    async () => {
      await pool.query(
        `UPDATE dealer_overrides
         SET purge_requested_at = NOW(), purge_requested_by = $2::uuid, updated_at = NOW(), updated_by = $2::uuid
         WHERE dealer_id = $1`,
        [dealerId, me.id],
      );
      await logDealerAuditEvent(pool, {
        dealerId,
        eventKind: "dealer_purge_requested",
        userId: me.id,
      });
    },
  );

  await removeDealerFromActualizationTrashBlob(pool, me.id, dealerId);

  const override = await fetchOverride(pool, dealerId);
  sendJson(res, 200, { success: true, data: { override } });
}

export async function handleDealerOverridesRestore(
  req: VercelRequest,
  res: VercelResponse,
  pool: PoolLike,
  me: SessionUser,
): Promise<void> {
  if (!assertActiveUser(me, res)) return;
  const dealerId = parseDealerId(req);
  const target = parseRestoreTarget(req);
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }

  const ov = await fetchOverride(pool, dealerId);
  if (isPurged(ov)) {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись soft-deleted." });
    return;
  }

  if (isAdminQueue(ov)) {
    if (!isAdminDirector(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только admin/director." });
      return;
    }
    await runOverridesHandlerSafe(
      pool,
      target === "active" ? "dealer_restore_active" : "dealer_restore_employee_trash",
      dealerId,
      { dealer_id: dealerId, target },
      me.id,
      async () => {
        if (target === "active") {
          await pool.query(
            `UPDATE dealer_overrides
             SET trashed_at = NULL, trashed_by = NULL,
                 purge_requested_at = NULL, purge_requested_by = NULL,
                 updated_at = NOW(), updated_by = $2::uuid
             WHERE dealer_id = $1`,
            [dealerId, me.id],
          );
          await logDealerAuditEvent(pool, {
            dealerId,
            eventKind: "dealer_restored_to_active",
            userId: me.id,
          });
        } else {
          await pool.query(
            `UPDATE dealer_overrides
             SET purge_requested_at = NULL, purge_requested_by = NULL,
                 updated_at = NOW(), updated_by = $2::uuid
             WHERE dealer_id = $1`,
            [dealerId, me.id],
          );
          await logDealerAuditEvent(pool, {
            dealerId,
            eventKind: "dealer_restored_to_employee_trash",
            userId: me.id,
          });
        }
      },
    );
  } else if (isEmployeeTrash(ov)) {
    const check = await canUserTrashDealer(pool, me.id, me.role, dealerId);
    if (!check.allowed) {
      sendJson(res, 403, {
        success: false,
        code: "FORBIDDEN_OUT_OF_SCOPE",
        message: "Этот клиент вне вашей зоны ответственности.",
      });
      return;
    }
    await runOverridesHandlerSafe(
      pool,
      "dealer_restore_active",
      dealerId,
      { dealer_id: dealerId, target: "active" },
      me.id,
      async () => {
        await pool.query(
          `UPDATE dealer_overrides
           SET trashed_at = NULL, trashed_by = NULL,
               purge_requested_at = NULL, purge_requested_by = NULL,
               updated_at = NOW(), updated_by = $2::uuid
           WHERE dealer_id = $1`,
          [dealerId, me.id],
        );
        await logDealerAuditEvent(pool, {
          dealerId,
          eventKind: "dealer_restored_to_active",
          userId: me.id,
        });
      },
    );
  } else {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись не в корзине." });
    return;
  }

  const override = await fetchOverride(pool, dealerId);
  sendJson(res, 200, { success: true, data: { override } });
}

export async function handleDealerOverridesPurge(
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
  const dealerId = parseDealerId(req);
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }

  const ov = await fetchOverride(pool, dealerId);
  if (!isAdminQueue(ov)) {
    sendJson(res, 409, {
      success: false,
      code: "INVALID_STATE",
      message: "Запись не в корзине админа.",
    });
    return;
  }

  await runOverridesHandlerSafe(pool, "dealer_purge", dealerId, { dealer_id: dealerId }, me.id, async () => {
    await pool.query(
      `UPDATE dealer_overrides
       SET purged_at = NOW(), purged_by = $2::uuid, updated_at = NOW(), updated_by = $2::uuid
       WHERE dealer_id = $1`,
      [dealerId, me.id],
    );
    await logDealerAuditEvent(pool, {
      dealerId,
      eventKind: "dealer_purged",
      userId: me.id,
    });
  });

  const override = await fetchOverride(pool, dealerId);
  sendJson(res, 200, { success: true, data: { override } });
}

export async function handleDealerOverridesAdminRestore(
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
  const dealerId = parseDealerId(req);
  if (!dealerId) {
    sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
    return;
  }

  const ov = await fetchOverride(pool, dealerId);
  if (!isPurged(ov)) {
    sendJson(res, 409, { success: false, code: "INVALID_STATE", message: "Запись не soft-deleted." });
    return;
  }

  await runOverridesHandlerSafe(pool, "dealer_admin_restore", dealerId, { dealer_id: dealerId }, me.id, async () => {
    await pool.query(
      `UPDATE dealer_overrides
       SET purged_at = NULL, purged_by = NULL, updated_at = NOW(), updated_by = $2::uuid
       WHERE dealer_id = $1`,
      [dealerId, me.id],
    );
    await logDealerAuditEvent(pool, {
      dealerId,
      eventKind: "dealer_admin_restored",
      userId: me.id,
    });
  });

  const override = await fetchOverride(pool, dealerId);
  sendJson(res, 200, { success: true, data: { override } });
}
