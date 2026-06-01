/**
 * POST /api/admin/clear-stuck-pending-sync — инструкция / фильтр для очистки клиентской очереди (Промт 114.4).
 *
 * Очередь pendingSyncStore хранится в localStorage браузера — сервер не может удалить её напрямую.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }
    if (!enforceCsrfOrigin(req)) {
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
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для admin." });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const dealerIds = Array.isArray(body.dealerIds)
      ? body.dealerIds.filter((x): x is string => typeof x === "string" && x.trim()).map((x) => x.trim())
      : [];

    sendJson(res, 200, {
      success: true,
      data: {
        serverCleared: 0,
        message:
          "Очередь pendingSyncStore хранится в localStorage браузера. При следующем входе пользователя сработает автоматическая очистка UUID-ошибок (флаг tandoor-pending-sync-cleanup-uuid-v1-<userId>). Для немедленной очистки откройте /admin/sync-health и нажмите «Очистить застрявшие UUID» или удалите ключ tandoor:overrides:pending-v1 в DevTools.",
        requestedUserId: userId || null,
        requestedDealerIds: dealerIds,
        localStorageKey: "tandoor:overrides:pending-v1",
      },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[clear-stuck-pending-sync]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка." });
  }
}
