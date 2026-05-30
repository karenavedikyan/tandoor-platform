/**
 * Trade point overrides API (Промт 113):
 *   GET  /api/trade-point-overrides/list|get
 *   POST /api/trade-point-overrides/upsert|set-training|trash|untrash
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
  handleTradePointOverridesGet,
  handleTradePointOverridesList,
  handleTradePointOverridesSetTraining,
  handleTradePointOverridesTrash,
  handleTradePointOverridesUntrash,
  handleTradePointOverridesUpsert,
} from "../../shared/trade-point-overrides-handlers.js";

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
      await handleTradePointOverridesList(req, res, pool, sessionUser);
      return;
    }
    if (action === "get" && req.method === "GET") {
      await handleTradePointOverridesGet(req, res, pool, sessionUser);
      return;
    }
    if (action === "upsert" && req.method === "POST") {
      await handleTradePointOverridesUpsert(req, res, pool, sessionUser);
      return;
    }
    if (action === "set-training" && req.method === "POST") {
      await handleTradePointOverridesSetTraining(req, res, pool, sessionUser);
      return;
    }
    if (action === "trash" && req.method === "POST") {
      await handleTradePointOverridesTrash(req, res, pool, sessionUser);
      return;
    }
    if (action === "untrash" && req.method === "POST") {
      await handleTradePointOverridesUntrash(req, res, pool, sessionUser);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут trade-point-overrides." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[trade-point-overrides-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
