/**
 * POST /api/perf/web-vitals — ingest Web Vitals (sendBeacon).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, sendJson } from "../../shared/admin/admin-auth.js";
import {
  checkWebVitalsRateLimit,
  insertWebVitalsEvent,
  isWebVitalsEnabled,
  validateWebVitalsPayload,
} from "../../shared/web-vitals-handlers.js";

function readClientIp(req: VercelRequest): string {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",")[0]?.trim() ?? "unknown";
  }
  const socketIp = (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress;
  return socketIp?.trim() || "unknown";
}

async function readJsonBody(req: VercelRequest): Promise<unknown> {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED" });
      return;
    }
    if (!isWebVitalsEnabled()) {
      res.status(204).end();
      return;
    }
    if (!checkWebVitalsRateLimit(readClientIp(req))) {
      sendJson(res, 429, { success: false, code: "RATE_LIMITED", message: "Слишком много запросов." });
      return;
    }

    const raw = await readJsonBody(req);
    const parsed = validateWebVitalsPayload(raw);
    if (!parsed.ok) {
      sendJson(res, 400, { success: false, code: "INVALID_PAYLOAD", message: parsed.message });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE" });
      return;
    }

    await insertWebVitalsEvent(pool, parsed.data);
    res.status(204).end();
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[perf/web-vitals]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
