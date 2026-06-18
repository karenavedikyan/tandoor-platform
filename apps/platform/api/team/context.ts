/**
 * GET /api/team/context — teamId, teamMemberIds, teamCodes (Промт 398).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { fetchTeamContext } from "../../shared/team-context-handlers.js";

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
    if (me.status !== "active") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Аккаунт не активен." });
      return;
    }

    const payload = await fetchTeamContext(pool, { id: me.id, role: me.role });
    res.setHeader("Cache-Control", "private, max-age=60");
    sendJson(res, 200, payload as unknown as Record<string, unknown>);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[team/context]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
