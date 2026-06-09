/**
 * In-app notifications API (Промт 230d).
 *   GET  /api/notifications/list?unread=1&limit=30
 *   GET  /api/notifications/unread-count
 *   POST /api/notifications/mark-read   { ids: string[] }
 *   POST /api/notifications/mark-all-read
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
  handleList,
  handleMarkAllRead,
  handleMarkRead,
  handleUnreadCount,
  NotificationValidationError,
} from "../../shared/notifications-handlers.js";

function parseLimit(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
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

    if (action === "list" && req.method === "GET") {
      const unreadRaw = req.query.unread;
      const onlyUnread = (Array.isArray(unreadRaw) ? unreadRaw[0] : unreadRaw) === "1";
      const limitRaw = req.query.limit;
      const limit = parseLimit(Array.isArray(limitRaw) ? limitRaw[0] : limitRaw);
      sendJson(res, 200, await handleList(pool, me.id, { onlyUnread, limit }));
      return;
    }

    if (action === "unread-count" && req.method === "GET") {
      sendJson(res, 200, await handleUnreadCount(pool, me.id));
      return;
    }

    if (req.method === "POST") {
      if (action === "mark-read") {
        const rawIds = body.ids;
        const ids = Array.isArray(rawIds) ? rawIds.map((x) => String(x)) : [];
        sendJson(res, 200, await handleMarkRead(pool, me.id, ids));
        return;
      }
      if (action === "mark-all-read") {
        sendJson(res, 200, await handleMarkAllRead(pool, me.id));
        return;
      }
    }

    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Метод не поддерживается." });
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут notifications." });
  } catch (e) {
    if (e instanceof NotificationValidationError) {
      const status = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 400;
      sendJson(res, status, { success: false, code: e.code, message: e.message });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[notifications-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
