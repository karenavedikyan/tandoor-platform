/**
 * GET /api/clients-1c/list
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, sendJson } from "../../shared/admin/admin-auth.js";
import { handleClients1cList } from "../../shared/clients-1c/handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { ok: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }
    await handleClients1cList(req, res, pool);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[clients-1c/list]", m);
    sendJson(res, 500, { ok: false, code: "INTERNAL_ERROR", message: m });
  }
}
