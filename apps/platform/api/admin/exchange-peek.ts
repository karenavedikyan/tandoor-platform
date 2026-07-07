/**
 * GET /api/admin/exchange-peek?path=/import_users/employers1&bytes=8192
 * Возвращает первые N байт файла обмена 1С через Yandex VM-прокси как text/plain.
 * Только для роли admin.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, vercelHeaders } from "../../shared/admin/admin-auth.js";
import {
  EXCHANGE_S3_BASE,
  exchangeProxyAuthHeaders,
  fetchWithRetry,
  resolveExchangeProxyConfig,
} from "../../shared/admin/exchange-fetch.js";

const MAX_BYTES = 65_536;
const DEFAULT_BYTES = 8_192;

async function readProxyErrorMessage(r: Response): Promise<string> {
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = (await r.json().catch(() => ({}))) as { message?: string };
    return json.message ?? `Proxy HTTP ${r.status}`;
  }
  return `Proxy HTTP ${r.status}`;
}

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

    const proxy = resolveExchangeProxyConfig();
    if (!proxy) {
      res.status(503).json({
        success: false,
        code: "PROXY_NOT_CONFIGURED",
        message: "EXCHANGE_PROXY_URL не настроен (Yandex VM proxy).",
      });
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

    const s3Url = `${EXCHANGE_S3_BASE}${rawPath}`;
    const proxyUrl = `${proxy.proxyUrl}/exchange/peek?path=${encodeURIComponent(rawPath)}&bytes=${bytes}`;
    try {
      const r = await fetchWithRetry(proxyUrl, "*/*", exchangeProxyAuthHeaders(proxy.token));
      if (!r.ok) {
        const message = await readProxyErrorMessage(r);
        res.status(r.status === 404 ? 404 : 502).json({
          success: false,
          code: r.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR",
          message,
          url: s3Url,
        });
        return;
      }
      const totalSize = r.headers.get("x-exchange-total-size");
      const contentType = r.headers.get("x-exchange-content-type") ?? r.headers.get("content-type");
      const bytesReturned = r.headers.get("x-exchange-bytes-returned");
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Exchange-Total-Size", totalSize ?? "unknown");
      res.setHeader("X-Exchange-Content-Type", contentType ?? "application/octet-stream");
      res.setHeader("X-Exchange-Bytes-Returned", bytesReturned ?? String(buf.length));
      res.status(200).send(buf.toString("utf8"));
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      res.status(502).json({
        success: false,
        code: "UPSTREAM_UNREACHABLE",
        message: `VM proxy недоступен: ${m}`,
        url: s3Url,
      });
      return;
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[exchange-peek]", m);
    res.status(500).json({ success: false, code: "INTERNAL_ERROR", message: m });
  }
}
