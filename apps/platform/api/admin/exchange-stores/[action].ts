/**
 * Vercel Serverless: exchange-stores sub-routes.
 *
 * POST /api/admin/exchange-stores/action
 * GET  /api/admin/exchange-stores/candidates?id_1c=...
 * POST /api/admin/exchange-stores/auto-link
 * GET  /api/admin/exchange-stores/search-trade-points?q=...
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../../shared/admin/admin-auth.js";
import {
  handleExchangeStoresAction,
  handleExchangeStoresAutoLink,
  handleExchangeStoresCandidates,
  handleSearchTradePoints,
} from "../../../shared/admin/exchange-stores-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

    if (req.method === "POST" && !enforceCsrfOrigin(req)) {
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
    if (me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    if (action === "action" && req.method === "POST") {
      await handleExchangeStoresAction(req, res, pool, me);
      return;
    }
    if (action === "candidates" && req.method === "GET") {
      await handleExchangeStoresCandidates(req, res, pool);
      return;
    }
    if (action === "auto-link" && req.method === "POST") {
      await handleExchangeStoresAutoLink(res, pool, me);
      return;
    }
    if (action === "search-trade-points" && req.method === "GET") {
      await handleSearchTradePoints(req, res, pool);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестное действие." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[exchange-stores/action]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
