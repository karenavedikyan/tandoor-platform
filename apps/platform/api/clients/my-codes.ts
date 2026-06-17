/**
 * GET /api/clients/my-codes — закреплённые client_code из client_assignments.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { fetchMyClientCodes } from "../../shared/my-client-codes-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
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

    const payload = await fetchMyClientCodes(pool, { id: me.id, role: me.role });
    sendJson(res, 200, payload as unknown as Record<string, unknown>);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/clients/my-codes]", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
