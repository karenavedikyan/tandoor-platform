/**
 * POST /api/dealers-shadow-audit — ручная полная сверка seed ↔ БД (Промт 374).
 * Доступ: admin, category_manager.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../shared/admin/admin-auth.js";
import { runDealersShadowAudit } from "../server/api/dealers-shadow-audit-api.js";

const AUDIT_ROLES = new Set(["admin", "category_manager"]);

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
      sendJson(res, 503, {
        success: false,
        code: "DB_UNAVAILABLE",
        message: "База данных недоступна.",
      });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    if (me.status !== "active" || !AUDIT_ROLES.has(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    const scope = typeof req.body === "object" && req.body && "scope" in req.body
      ? String((req.body as { scope?: unknown }).scope ?? "audit")
      : "audit";

    const payload = await runDealersShadowAudit(pool, scope);
    sendJson(res, 200, payload);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[dealers-shadow-audit]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
