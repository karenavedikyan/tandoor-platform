/**
 * GET /api/clients-1c/:holdingId
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, sendJson } from "../../shared/admin/admin-auth.js";
import { handleClients1cHolding } from "../../shared/clients-1c/handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { ok: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const holdingRaw = req.query.holdingId;
    const holdingId = Array.isArray(holdingRaw) ? String(holdingRaw[0] ?? "") : String(holdingRaw ?? "");
    await handleClients1cHolding(req, res, pool, holdingId);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[clients-1c/holding]", m);
    sendJson(res, 500, { ok: false, code: "INTERNAL_ERROR", message: m });
  }
}
