/**
 * GET /api/diag/manager-scope-explain?userId=<uuid>  (admin/director only)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { buildManagerScopeExplain } from "../../shared/manager-scope-explain.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
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

    if (me.role !== "admin" && me.role !== "director") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Доступ только для admin/director." });
      return;
    }

    const userIdRaw = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!userIdRaw) {
      sendJson(res, 400, { success: false, code: "BAD_REQUEST", message: "Параметр userId обязателен." });
      return;
    }

    const targetQ = await pool.query<{ id: string; role: string }>(
      `SELECT id::text, role FROM users WHERE id = $1::uuid LIMIT 1`,
      [userIdRaw],
    );
    const target = targetQ.rows[0];
    if (!target) {
      sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Пользователь не найден." });
      return;
    }

    const payload = await buildManagerScopeExplain(pool, target.id, target.role);
    sendJson(res, 200, { success: true, userId: target.id, role: target.role, ...payload });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/diag/manager-scope-explain]", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
