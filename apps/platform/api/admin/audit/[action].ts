/**
 * Admin audit API (Промт 430): `/api/admin/audit/list` | `/api/admin/audit/sources`
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, sendJson, vercelHeaders } from "../../../shared/admin/admin-auth.js";
import {
  handleAdminAuditList,
  handleAdminAuditSources,
} from "../../../shared/admin/audit-ui-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const actionRaw = req.query.action;
  const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

  try {
    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const headers = vercelHeaders(req);

    if (action === "list" && req.method === "GET") {
      await handleAdminAuditList(req, res, pool, headers);
      return;
    }
    if (action === "sources" && req.method === "GET") {
      await handleAdminAuditSources(res, pool, headers);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестное действие." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/audit]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
