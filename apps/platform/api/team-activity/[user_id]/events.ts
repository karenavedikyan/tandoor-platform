/**
 * GET /api/team-activity/:user_id/events?range=7d|30d&limit=50
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../../shared/admin/admin-auth.js";
import {
  fetchTeamActivityEvents,
  isTeamActivityManagerForbidden,
} from "../../../shared/team-activity-handlers.js";

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

    if (isTeamActivityManagerForbidden(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    const userIdRaw = req.query.user_id;
    const userId = Array.isArray(userIdRaw) ? String(userIdRaw[0] ?? "") : String(userIdRaw ?? "");
    if (!userId.trim()) {
      sendJson(res, 400, { success: false, code: "INVALID_USER", message: "Укажите user_id." });
      return;
    }

    const rangeRaw = req.query.range;
    const range = Array.isArray(rangeRaw) ? String(rangeRaw[0] ?? "") : String(rangeRaw ?? "");
    const limitRaw = req.query.limit;
    const limit = Array.isArray(limitRaw) ? Number(limitRaw[0]) : Number(limitRaw);

    const payload = await fetchTeamActivityEvents(pool, me, userId.trim(), { range, limit });
    sendJson(res, 200, payload as unknown as Record<string, unknown>);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "INTERNAL_ERROR";
    if (code === "FORBIDDEN") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[team-activity/events]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
