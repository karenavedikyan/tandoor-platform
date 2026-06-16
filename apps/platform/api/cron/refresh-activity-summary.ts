/**
 * GET/POST /api/cron/refresh-activity-summary — ночной пересчёт activity_summary (03:00 МСК).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../shared/admin/admin-auth.js";
import { refreshActivitySummary } from "../../shared/team-activity-handlers.js";

export const config = {
  maxDuration: 300,
};

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

function isCronAuthorized(req: VercelRequest): boolean {
  const cronH = req.headers["x-vercel-cron"];
  const cronV = Array.isArray(cronH) ? cronH[0] : cronH;
  if (typeof cronV === "string" && cronV.trim() === "1") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers["authorization"];
    const av = Array.isArray(auth) ? auth[0] : auth;
    if (typeof av === "string" && av.trim() === `Bearer ${secret}`) return true;
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isCronAuthorized(req)) {
      sendJson(res, 401, { ok: false, code: "UNAUTHORIZED" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { ok: false, code: "DB_UNAVAILABLE" });
      return;
    }

    const result = await refreshActivitySummary(pool);
    sendJson(res, 200, { ok: true, ...result });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[cron/refresh-activity-summary]", m);
    sendJson(res, 500, { ok: false, code: "INTERNAL_ERROR", message: m });
  }
}
