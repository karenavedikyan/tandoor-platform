/**
 * GET /api/clients-1c/:holdingId/tp/:storeId
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, sendJson } from "../../../shared/admin/admin-auth.js";
import { handleClients1cStore } from "../../../shared/clients-1c/handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { ok: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const holdingRaw = req.query.holdingId;
    const storeRaw = req.query.storeId;
    const holdingId = Array.isArray(holdingRaw) ? String(holdingRaw[0] ?? "") : String(holdingRaw ?? "");
    const storeId = Array.isArray(storeRaw) ? String(storeRaw[0] ?? "") : String(storeRaw ?? "");
    await handleClients1cStore(req, res, pool, holdingId, storeId);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[clients-1c/store]", m);
    sendJson(res, 500, { ok: false, code: "INTERNAL_ERROR", message: m });
  }
}
