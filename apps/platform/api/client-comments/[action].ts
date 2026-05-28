/**
 * Client comments API (Промт 69):
 *   GET  /api/client-comments/list?clientId=
 *   POST /api/client-comments/create
 *   POST /api/client-comments/request-delete
 *   POST /api/client-comments/bulk-import
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
  handleClientCommentsBulkImport,
  handleClientCommentsCreate,
  handleClientCommentsList,
  handleClientCommentsRequestDelete,
} from "../../shared/client-comments-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

    if (req.method !== "GET" && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, {
        success: false,
        code: "DB_UNAVAILABLE",
        message: "База данных недоступна.",
      });
      return;
    }

    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const sessionUser = { id: me.id, role: me.role, status: me.status };

    if (action === "list" && req.method === "GET") {
      await handleClientCommentsList(req, res, pool, sessionUser);
      return;
    }
    if (action === "create" && req.method === "POST") {
      await handleClientCommentsCreate(req, res, pool, sessionUser);
      return;
    }
    if (action === "request-delete" && req.method === "POST") {
      await handleClientCommentsRequestDelete(req, res, pool, sessionUser);
      return;
    }
    if (action === "bulk-import" && req.method === "POST") {
      await handleClientCommentsBulkImport(req, res, pool, sessionUser);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут client-comments." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[client-comments-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
