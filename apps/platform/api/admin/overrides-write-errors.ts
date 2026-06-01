/**
 * GET /api/admin/overrides-write-errors — последние ошибки записи overrides (Промт 114.4).
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

    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 100) : 50;
    const actorUserId =
      typeof req.query.actor_user_id === "string" ? req.query.actor_user_id.trim() : "";

    const params: unknown[] = actorUserId ? [actorUserId, limit] : [limit];
    const limitParam = actorUserId ? "$2" : "$1";
    const actorClause = actorUserId ? "WHERE actor_user_id = $1::uuid" : "";

    const r = await pool.query<Record<string, unknown>>(
      `SELECT id, entity_kind, entity_id, payload, error_message, actor_user_id, permanent, created_at
       FROM overrides_write_errors
       ${actorClause}
       ORDER BY created_at DESC
       LIMIT ${limitParam}`,
      params,
    );

    sendJson(res, 200, {
      success: true,
      data: r.rows.map((row) => ({
        id: String(row.id),
        entity_kind: String(row.entity_kind),
        entity_id: String(row.entity_id),
        payload: row.payload ?? null,
        error_message: String(row.error_message),
        actor_user_id: row.actor_user_id != null ? String(row.actor_user_id) : null,
        permanent: row.permanent === true || row.permanent === "t",
        created_at: String(row.created_at),
      })),
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[overrides-write-errors-api]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка." });
  }
}
