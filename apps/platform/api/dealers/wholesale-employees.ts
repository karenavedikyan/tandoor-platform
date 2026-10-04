/**
 * GET /api/dealers/wholesale-employees — 1C OPT roster for admin preview picker.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { canAccessWholesaleOrgRead, fetchWholesaleEmployees } from "../../shared/wholesale-org-handlers.js";
import type { UserRole } from "../../shared/auth.js";

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
    if (!canAccessWholesaleOrgRead(me.role as UserRole)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    const data = await fetchWholesaleEmployees(pool);
    if (!data.rosterAvailable && data.rosterError) {
      sendJson(res, 503, {
        success: false,
        code: "ROSTER_UNAVAILABLE",
        message: "Справочник сотрудников ОПТ недоступен.",
        rosterError: data.rosterError,
      });
      return;
    }

    sendJson(res, 200, data as unknown as Record<string, unknown>);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/dealers/wholesale-employees]", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
