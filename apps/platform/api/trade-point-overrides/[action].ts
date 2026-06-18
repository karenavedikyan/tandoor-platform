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
import {
  handleTradePointOverridesAdminRestore,
  handleTradePointOverridesPurge,
  handleTradePointOverridesRequestPurge,
  handleTradePointOverridesRestore,
} from "../../shared/trade-point-purge-handlers.js";
import { handleBulkMoveArchiveToTrash as handleTpBulkMoveArchiveToTrash } from "../../shared/trade-point-bulk-archive-handlers.js";
import {
  isOverridesWriteAction,
  withOverridesApiAccessLog,
} from "../../shared/overrides-api-access-log.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const actionRaw = req.query.action;
  const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");
  const route = `/api/trade-point-overrides/${action}`;
  const method = req.method ?? "GET";
  const isWrite = isOverridesWriteAction(action);

  try {
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
    const body = req.body;

    const runLogged = async (fn: () => Promise<void>): Promise<void> => {
      await withOverridesApiAccessLog(
        pool,
        { route, method, actorUserId: me.id, body, isWrite },
        res,
        fn,
      );
    };

    if (action === "list" && req.method === "GET") {
      await runLogged(() => handleTradePointOverridesList(req, res, pool, sessionUser));
      return;
    }
    if (action === "get" && req.method === "GET") {
      await runLogged(() => handleTradePointOverridesGet(req, res, pool, sessionUser));
      return;
    }
    if (action === "upsert" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesUpsert(req, res, pool, sessionUser));
      return;
    }
    if (action === "set-training" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesSetTraining(req, res, pool, sessionUser));
      return;
    }
    if (action === "trash" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesTrash(req, res, pool, sessionUser));
      return;
    }
    if (action === "untrash" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesUntrash(req, res, pool, sessionUser));
      return;
    }
    if (action === "request-purge" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesRequestPurge(req, res, pool, sessionUser));
      return;
    }
    if (action === "restore" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesRestore(req, res, pool, sessionUser));
      return;
    }
    if (action === "purge" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesPurge(req, res, pool, sessionUser));
      return;
    }
    if (action === "admin-restore" && req.method === "POST") {
      await runLogged(() => handleTradePointOverridesAdminRestore(req, res, pool, sessionUser));
      return;
    }
    if (action === "bulk-move-archive-to-trash" && req.method === "POST") {
      await runLogged(() => handleTpBulkMoveArchiveToTrash(req, res, pool, sessionUser));
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут trade-point-overrides." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[trade-point-overrides-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
