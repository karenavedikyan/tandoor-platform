/**
 * GET/POST /api/cron/distribution-export — почасовая выгрузка дистрибуции ЛК → FTP для 1С.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../shared/admin/admin-auth.js";
import { runDistributionExport } from "../../shared/distribution-export/run-export.js";

export const config = {
  maxDuration: 300,
};

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

function isSyncAuthorized(req: VercelRequest): boolean {
  const expected = process.env.SYNC_RUNNER_TOKEN?.trim();
  if (expected) {
    const hdr = req.headers["x-sync-token"];
    const v = Array.isArray(hdr) ? hdr[0] : hdr;
    if (typeof v === "string" && v.trim() === expected) return true;
  }

  const cronH = req.headers["x-vercel-cron"];
  const cronV = Array.isArray(cronH) ? cronH[0] : cronH;
  if (typeof cronV === "string" && cronV.trim() === "1") return true;

  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isSyncAuthorized(req)) {
      sendJson(res, 401, { success: false, code: "UNAUTHORIZED" });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const result = await runDistributionExport(pool);
    sendJson(res, 200, { success: true, ...result });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[cron/distribution-export]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
