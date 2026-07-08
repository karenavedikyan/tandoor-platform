/**
 * POST /api/admin/refresh-clients-1c-mv — refresh mv_stores_1c + mv_clients_1c (cron every 10 min).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../shared/admin/admin-auth.js";
import { refreshClients1cMv } from "../../shared/clients-1c/refresh-mv.js";

export const config = {
  maxDuration: 300,
};

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

function isRefreshAuthorized(req: VercelRequest): boolean {
  const expected = process.env.SYNC_RUNNER_TOKEN?.trim();
  if (expected) {
    const auth = req.headers.authorization;
    const authStr = Array.isArray(auth) ? auth[0] : auth;
    if (typeof authStr === "string" && authStr.trim() === `Bearer ${expected}`) return true;

    const hdr = req.headers["x-sync-token"];
    const v = Array.isArray(hdr) ? hdr[0] : hdr;
    if (typeof v === "string" && v.trim() === expected) return true;
  }

  const cronH = req.headers["x-vercel-cron"];
  const cronV = Array.isArray(cronH) ? cronH[0] : cronH;
  return typeof cronV === "string" && cronV.trim() === "1";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isRefreshAuthorized(req)) {
      sendJson(res, 401, { ok: false, code: "UNAUTHORIZED" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { ok: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const result = await refreshClients1cMv(pool);
    sendJson(res, 200, result);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[admin/refresh-clients-1c-mv]", m);
    sendJson(res, 500, { ok: false, code: "INTERNAL_ERROR", message: m });
  }
}
