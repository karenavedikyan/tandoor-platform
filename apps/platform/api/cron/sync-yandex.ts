/**
 * GET/POST /api/cron/sync-yandex — ночная полная синхронизация Neon → Yandex (резерв 1:1).
 * 00:00 UTC = 03:00 МСК.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dumpNeonToBlob } from "../../server/db-migrate/dump-neon.js";
import { restoreYandexFromBlob } from "../../server/db-migrate/restore-yandex.js";
import { isPgProxyConfigured } from "../../server/db/pg-proxy-client.js";

export const config = {
  maxDuration: 800,
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

function collectMissingEnv(): string[] {
  const missing: string[] = [];
  const neonUrl =
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.POSTGRES_URL_NON_POOLING?.trim();
  if (!neonUrl) missing.push("DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING");
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) missing.push("BLOB_READ_WRITE_TOKEN");
  if (!isPgProxyConfigured()) missing.push("PG_PROXY_URL|PG_PROXY_TOKEN");
  return missing;
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

    const missing = collectMissingEnv();
    if (missing.length > 0) {
      sendJson(res, 503, { ok: false, code: "ENV_NOT_CONFIGURED", missing });
      return;
    }

    const neonUrl =
      process.env.DATABASE_URL_UNPOOLED!.trim() || process.env.POSTGRES_URL_NON_POOLING!.trim();
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN!.trim();

    console.log("[cron/sync-yandex] dump started");
    const dump = await dumpNeonToBlob({
      sourceUrl: neonUrl,
      blobToken,
      filenamePrefix: "tandoor-yandex-sync",
    });
    console.log("[cron/sync-yandex] dump done", {
      filename: dump.filename,
      sizeBytes: dump.sizeBytes,
      durationMs: dump.durationMs,
    });

    console.log("[cron/sync-yandex] restore started (truncate-and-load)");
    const restore = await restoreYandexFromBlob({
      blobUrl: dump.blobUrl,
      mode: "truncate-and-load",
    });
    console.log("[cron/sync-yandex] restore done", {
      errorsCount: restore.errors.length,
      durationMs: restore.durationMs,
    });

    sendJson(res, 200, {
      ok: true,
      dump: {
        filename: dump.filename,
        sizeBytes: dump.sizeBytes,
        rowCounts: dump.rowCounts,
        durationMs: dump.durationMs,
      },
      restore: {
        rowCounts: restore.rowCounts,
        errorsCount: restore.errors.length,
        durationMs: restore.durationMs,
      },
      partial: restore.errors.length > 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[cron/sync-yandex] SYNC_FAILED", message);
    sendJson(res, 500, { ok: false, code: "SYNC_FAILED", message });
  }
}
