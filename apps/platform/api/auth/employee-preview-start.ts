/**
 * POST /api/auth/employee-preview-start — admin read-only preview of 1C employee scope.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveActiveSessionUser,
  resolveRefreshTokenHash,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { startEmployeePreview, parseAssignmentType } from "../../shared/wholesale-preview-handlers.js";
import type { UserRole } from "../../shared/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }
    if (!enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_ORIGIN", message: "Запрос отклонён проверкой origin." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const headers = vercelHeaders(req);
    const me = await resolveActiveSessionUser(pool, headers);
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется активная сессия." });
      return;
    }

    const refreshTokenHash = resolveRefreshTokenHash(headers);
    if (!refreshTokenHash) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Сессия недействительна." });
      return;
    }

    const body = (req.body ?? {}) as { employeeGuid?: unknown; assignmentType?: unknown };
    const employeeGuid = typeof body.employeeGuid === "string" ? body.employeeGuid.trim() : "";
    const assignmentType = parseAssignmentType(body.assignmentType);
    if (!assignmentType) {
      sendJson(res, 400, {
        success: false,
        code: "INVALID_ASSIGNMENT",
        message: "Некорректный или отсутствующий тип назначения.",
      });
      return;
    }

    const result = await startEmployeePreview(pool, {
      actorRole: me.role as UserRole,
      actorStatus: me.status,
      actorUserId: me.id,
      refreshTokenHash,
      employeeGuid,
      assignmentType,
    });

    if (!result.ok) {
      const status =
        result.code === "FORBIDDEN" || result.code === "INACTIVE_ADMIN" ? 403 : 400;
      sendJson(res, status, { success: false, code: result.code, message: result.message });
      return;
    }

    sendJson(res, 200, { success: true, employee_preview: result.state });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/auth/employee-preview-start]", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
