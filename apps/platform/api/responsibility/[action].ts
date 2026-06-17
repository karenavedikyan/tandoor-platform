/**
 * Матрица ответственных API (Промт 233).
 *   GET  /api/responsibility/resolve?tradePointId=<tp>
 *   GET  /api/responsibility/client?dealerId=<id>
 *   POST /api/responsibility/assign   { scopeKind, scopeKey, role, userId | null, reason? }
 *   GET  /api/responsibility/my
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  handleAssign,
  handleClient,
  handleMy,
  handleResolve,
  ResponsibilityValidationError,
  type AssignBody,
} from "../../shared/responsibility-handlers.js";

function queryParam(req: VercelRequest, key: string): string {
  const raw = req.query[key];
  return (Array.isArray(raw) ? raw[0] : raw)?.toString().trim() ?? "";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const actionRaw = req.query.action;
  const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

  try {
    if (req.method !== "GET" && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.status !== "active") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (action === "resolve" && req.method === "GET") {
      sendJson(res, 200, await handleResolve(pool, queryParam(req, "tradePointId")));
      return;
    }

    if (action === "client" && req.method === "GET") {
      sendJson(res, 200, await handleClient(pool, queryParam(req, "dealerId")));
      return;
    }

    if (action === "my" && req.method === "GET") {
      sendJson(res, 200, await handleMy(pool, { id: me.id, role: me.role, status: me.status }));
      return;
    }

    if (action === "assign" && req.method === "POST") {
      sendJson(res, 200, await handleAssign(pool, { id: me.id, role: me.role, status: me.status }, body as AssignBody));
      return;
    }

    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Метод не поддерживается." });
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут responsibility." });
  } catch (e) {
    if (e instanceof ResponsibilityValidationError) {
      const status = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 400;
      sendJson(res, status, { success: false, code: e.code, message: e.message });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[responsibility-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
