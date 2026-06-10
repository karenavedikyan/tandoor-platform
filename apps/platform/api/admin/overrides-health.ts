/**
 * GET /api/admin/overrides-health — сводка ошибок overrides за последние 15 минут (Промт 114.4).
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
    if (me.role !== "admin" && me.role !== "director" && me.role !== "analyst") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для admin/director/analyst." });
      return;
    }

    const windowMinutes = 15;
    const countR = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM overrides_write_errors
       WHERE created_at >= NOW() - ($1::text || ' minutes')::interval`,
      [String(windowMinutes)],
    );
    const recentErrors = Number(countR.rows[0]?.n ?? 0);

    const lastR = await pool.query<Record<string, unknown>>(
      `SELECT entity_kind, entity_id, error_message, actor_user_id, permanent, created_at
       FROM overrides_write_errors
       WHERE created_at >= NOW() - ($1::text || ' minutes')::interval
       ORDER BY created_at DESC
       LIMIT 1`,
      [String(windowMinutes)],
    );
    const last = lastR.rows[0];

    const statusR = await pool.query<{ status: number; n: string }>(
      `SELECT response_status AS status, COUNT(*)::text AS n
       FROM overrides_api_access_log
       WHERE created_at >= NOW() - ($1::text || ' minutes')::interval
         AND response_status >= 400
       GROUP BY response_status
       ORDER BY COUNT(*) DESC`,
      [String(windowMinutes)],
    );

    sendJson(res, 200, {
      success: true,
      data: {
        windowMinutes,
        recentErrors,
        lastError: last
          ? {
              entityKind: String(last.entity_kind),
              entityId: String(last.entity_id),
              message: String(last.error_message),
              actorUserId: last.actor_user_id != null ? String(last.actor_user_id) : null,
              permanent: last.permanent === true || last.permanent === "t",
              createdAt: String(last.created_at),
            }
          : null,
        errorStatusBreakdown: statusR.rows.map((row) => ({
          status: Number(row.status),
          count: Number(row.n),
        })),
      },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[overrides-health]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка." });
  }
}
