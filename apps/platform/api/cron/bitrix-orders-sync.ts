/**
 * GET/POST /api/cron/bitrix-orders-sync — импорт заказов Bitrix из orders11.xml (каждые 10 мин).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { syncBitrixOrders } from "../../shared/bitrix-orders/importer.js";
import { getPrisma } from "../../shared/prisma-client.js";

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

    const result = await syncBitrixOrders(getPrisma());
    sendJson(res, 200, { success: true, ...result });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[cron/bitrix-orders-sync]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
