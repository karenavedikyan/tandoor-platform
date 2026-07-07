/**
 * GET /api/admin/exchange-peek?path=/import_users/employers1&bytes=8192
 * Возвращает первые N байт файла с https://s3.toopatch.ru/images/IMG/exchange<path> как text/plain.
 * Использует HTTP Range: bytes=0-(N-1). Никаких кредов не требуется.
 * Только для роли admin.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { fetchWithRetry } from "../../shared/admin/exchange-fetch.js";

const EXCHANGE_BASE = "https://s3.toopatch.ru/images/IMG/exchange";
const MAX_BYTES = 65_536;
const DEFAULT_BYTES = 8_192;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }
    const pool = getPool();
    if (!pool) {
      res.status(503).json({ success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }
    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      res.status(401).json({ success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.role !== "admin") {
      res.status(403).json({ success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    const rawPath = String(req.query.path ?? "").trim();
    if (!rawPath.startsWith("/") || rawPath.length > 300 || rawPath.includes("..") || rawPath.endsWith("/")) {
      res.status(400).json({ success: false, code: "BAD_PATH", message: "Некорректный путь (должен быть файл)." });
      return;
    }

    const bytesParam = Number(req.query.bytes ?? DEFAULT_BYTES);
    const bytes =
      Number.isFinite(bytesParam) && bytesParam > 0
        ? Math.min(Math.floor(bytesParam), MAX_BYTES)
        : DEFAULT_BYTES;

    const url = `${EXCHANGE_BASE}${rawPath}`;
    try {
      const r = await fetchWithRetry(url, "*/*", { Range: `bytes=0-${bytes - 1}` });
      if (r.status !== 200 && r.status !== 206) {
        res.status(r.status === 404 ? 404 : 502).json({
          success: false,
          code: r.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR",
          message: `Upstream HTTP ${r.status}`,
          url,
        });
        return;
      }
      const totalSize = r.headers.get("content-range")?.match(/\/(\d+)$/)?.[1] ?? null;
      const contentType = r.headers.get("content-type") ?? "application/octet-stream";
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Exchange-Total-Size", totalSize ?? "unknown");
      res.setHeader("X-Exchange-Content-Type", contentType);
      res.setHeader("X-Exchange-Bytes-Returned", String(buf.length));
      res.status(200).send(buf.toString("utf8"));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      res.status(502).json({
        success: false,
        code: "UPSTREAM_UNREACHABLE",
        message: `s3.toopatch.ru недоступен: ${m}`,
        url,
      });
      return;
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[exchange-peek]", m);
    res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: m });
  }
}
