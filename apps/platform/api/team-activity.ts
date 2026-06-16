/**
 * GET /api/team-activity?range=7d|30d&team_id=...
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  fetchTeamActivity,
  isTeamActivityManagerForbidden,
} from "../../shared/team-activity-handlers.js";

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

    const rangeRaw = req.query.range;
    const range = Array.isArray(rangeRaw) ? String(rangeRaw[0] ?? "") : String(rangeRaw ?? "");
    const teamRaw = req.query.team_id;
    const teamId = Array.isArray(teamRaw) ? String(teamRaw[0] ?? "") : String(teamRaw ?? "");

    const { payload, cacheHit } = await fetchTeamActivity(pool, me, {
      range,
      teamId: teamId || null,
    });

    if (cacheHit) res.setHeader("X-Cache", "HIT");
    else res.setHeader("X-Cache", "MISS");

    sendJson(res, 200, payload as unknown as Record<string, unknown>);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "INTERNAL_ERROR";
    if (code === "FORBIDDEN") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[team-activity]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
