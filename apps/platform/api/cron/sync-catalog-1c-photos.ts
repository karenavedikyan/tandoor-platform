/**
 * GET|POST /api/cron/sync-catalog-1c-photos — Vercel cron (0 4 * * * UTC).
 * PHOTO_SYNC_LIMIT env (default 500, max 2000).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isCronAuthorized } from "../../shared/cron-auth.js";
import { buildNeonExtraEnv, callRunner } from "../../shared/sync-catalog-runner.js";

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isCronAuthorized(req)) {
      sendJson(res, 401, { success: false, code: "UNAUTHORIZED" });
      return;
    }

    const limitEnv = Number(process.env.PHOTO_SYNC_LIMIT ?? 500);
    const limit =
      Number.isFinite(limitEnv) && limitEnv > 0 ? Math.min(Math.floor(limitEnv), 2000) : 500;

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!blobToken) {
      sendJson(res, 503, { success: false, code: "BLOB_NOT_CONFIGURED" });
      return;
    }

    const extraEnv = buildNeonExtraEnv("both");
    extraEnv.BLOB_READ_WRITE_TOKEN = blobToken;

    const proxyUrl = process.env.PG_PROXY_URL?.trim() || process.env.YANDEX_PROXY_URL?.trim();
    const proxyToken = process.env.PG_PROXY_TOKEN?.trim() || process.env.YANDEX_PROXY_TOKEN?.trim();
    if (proxyUrl) extraEnv.PG_PROXY_URL = proxyUrl;
    if (proxyToken) extraEnv.PG_PROXY_TOKEN = proxyToken;

    const ftpUser = process.env.FTP_USER?.trim();
    const ftpPassword = process.env.FTP_PASSWORD?.trim();
    if (ftpUser) extraEnv.FTP_USER = ftpUser;
    if (ftpPassword) extraEnv.FTP_PASSWORD = ftpPassword;

    const r = await callRunner("/run/photos", {
      target: "both",
      dry: false,
      limit,
      extraEnv,
    });

    if (!r.ok) {
      sendJson(res, r.status >= 400 && r.status < 600 ? r.status : 502, {
        success: false,
        code: String(r.json.code ?? "RUNNER_ERROR"),
        message: String(r.json.message ?? `Runner HTTP ${r.status}`),
        limit,
      });
      return;
    }

    sendJson(res, 202, { success: true, limit, runner: r.json });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[cron/sync-catalog-1c-photos]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
