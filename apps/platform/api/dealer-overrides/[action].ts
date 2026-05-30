/**
 * Dealer overrides API (Промт 113):
 *   GET  /api/dealer-overrides/list|get|history
 *   POST /api/dealer-overrides/upsert|set-training|trash|untrash|create-manual
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
  handleDealerOverridesCreateManual,
  handleDealerOverridesGet,
  handleDealerOverridesHistory,
  handleDealerOverridesList,
  handleDealerOverridesSetTraining,
  handleDealerOverridesTrash,
  handleDealerOverridesUntrash,
  handleDealerOverridesUpsert,
} from "../../shared/dealer-overrides-handlers.js";

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
      await handleDealerOverridesList(req, res, pool, sessionUser);
      return;
    }
    if (action === "get" && req.method === "GET") {
      await handleDealerOverridesGet(req, res, pool, sessionUser);
      return;
    }
    if (action === "history" && req.method === "GET") {
      await handleDealerOverridesHistory(req, res, pool, sessionUser);
      return;
    }
    if (action === "upsert" && req.method === "POST") {
      await handleDealerOverridesUpsert(req, res, pool, sessionUser);
      return;
    }
    if (action === "set-training" && req.method === "POST") {
      await handleDealerOverridesSetTraining(req, res, pool, sessionUser);
      return;
    }
    if (action === "trash" && req.method === "POST") {
      await handleDealerOverridesTrash(req, res, pool, sessionUser);
      return;
    }
    if (action === "untrash" && req.method === "POST") {
      await handleDealerOverridesUntrash(req, res, pool, sessionUser);
      return;
    }
    if (action === "create-manual" && req.method === "POST") {
      await handleDealerOverridesCreateManual(req, res, pool, sessionUser);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут dealer-overrides." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[dealer-overrides-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
