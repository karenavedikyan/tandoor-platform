/**
 * GET /api/admin/overrides-debug?dealer_id= — диагностика overrides по дилеру (Промт 113.2).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { mapDealerOverrideRow, mapDealerTrainingRow } from "../../shared/dealer-overrides-types.js";

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

    const dealerId = typeof req.query.dealer_id === "string" ? req.query.dealer_id.trim() : "";
    if (!dealerId) {
      sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealer_id." });
      return;
    }

    const [ov, tr, events, accessLog] = await Promise.all([
      pool.query<Record<string, unknown>>(`SELECT * FROM dealer_overrides WHERE dealer_id = $1 LIMIT 1`, [dealerId]),
      pool.query<Record<string, unknown>>(`SELECT * FROM dealer_training_state WHERE dealer_id = $1 LIMIT 1`, [
        dealerId,
      ]),
      pool.query<Record<string, unknown>>(
        `SELECT * FROM dealer_override_events WHERE dealer_id = $1 ORDER BY changed_at DESC LIMIT 10`,
        [dealerId],
      ),
      pool.query<Record<string, unknown>>(
        `SELECT id, route, method, actor_user_id, body_summary, response_status, response_code, duration_ms, created_at
         FROM overrides_api_access_log
         WHERE body_summary->>'dealer_id' = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [dealerId],
      ),
    ]);

    sendJson(res, 200, {
      success: true,
      data: {
        override_row: ov.rows[0] ? mapDealerOverrideRow(ov.rows[0]) : null,
        training_row: tr.rows[0] ? mapDealerTrainingRow(tr.rows[0]) : null,
        recent_events: events.rows,
        access_log: accessLog.rows.map((row) => ({
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
      },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[overrides-debug]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
