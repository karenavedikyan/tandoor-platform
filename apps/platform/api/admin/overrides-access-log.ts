/**
 * GET /api/admin/overrides-access-log — последние записи access-log overrides API (Промт 113.2).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";

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
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для admin/director." });
      return;
    }

    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 200) : 100;

    const r = await pool.query<Record<string, unknown>>(
      `SELECT id, route, method, actor_user_id, body_summary, response_status, response_code, duration_ms, created_at
       FROM overrides_api_access_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );

    sendJson(res, 200, {
      success: true,
      data: r.rows.map((row) => ({
        id: String(row.id),
        route: String(row.route),
        method: String(row.method),
        actor_user_id: row.actor_user_id != null ? String(row.actor_user_id) : null,
        body_summary: row.body_summary ?? null,
        response_status: row.response_status != null ? Number(row.response_status) : null,
        response_code: row.response_code != null ? String(row.response_code) : null,
        duration_ms: row.duration_ms != null ? Number(row.duration_ms) : null,
        created_at: String(row.created_at),
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[overrides-access-log]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
