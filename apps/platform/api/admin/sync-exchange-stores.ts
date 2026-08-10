/**
 * POST /api/admin/sync-exchange-stores
 * Импорт торговых точек из 1С (stores1.xml) в shadow-таблицу exchange_stores_raw.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import {
  applyExchangeRootPrefix,
  encodeExchangePathForProxy,
  exchangeProxyAuthHeaders,
  fetchWithRetry,
  resolveExchangeProxyConfig,
} from "../../shared/admin/exchange-fetch.js";
import { upsertExchangeStoresInBatches } from "../../shared/admin/exchange-stores-handlers.js";
import { parseExchangeStoresXml } from "../../shared/admin/exchange-stores-xml-parser.js";

const DEFAULT_SOURCE_FILE = "/import_stores/stores1.xml";
const PEEK_BYTES = 9_999_999;

function resolveSourceFile(req: VercelRequest): string {
  const fromQuery = req.query.sourceFile ?? req.query.path;
  const fromBody = (req.body as { sourceFile?: string; path?: string } | undefined)?.sourceFile
    ?? (req.body as { path?: string } | undefined)?.path;
  const raw = String(fromQuery ?? fromBody ?? DEFAULT_SOURCE_FILE).trim();
  if (!raw.startsWith("/") || raw.includes("..") || raw.length > 300) {
    return DEFAULT_SOURCE_FILE;
  }
  return raw;
}

async function readProxyErrorMessage(r: Response): Promise<string> {
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const json = (await r.json().catch(() => ({}))) as { message?: string };
    return json.message ?? `Proxy HTTP ${r.status}`;
  }
  return `Proxy HTTP ${r.status}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const started = Date.now();
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только POST." });
      return;
    }
    if (!enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }
    if (me.role !== "admin") {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Только для администратора." });
      return;
    }

    const proxy = resolveExchangeProxyConfig();
    if (!proxy) {
      sendJson(res, 503, {
        success: false,
        code: "PROXY_NOT_CONFIGURED",
        message: "EXCHANGE_PROXY_URL не настроен (Yandex VM proxy).",
      });
      return;
    }

    const sourceFile = resolveSourceFile(req);
    const proxyPath = applyExchangeRootPrefix(sourceFile);
    const proxyUrl = `${proxy.proxyUrl}/exchange/peek?path=${encodeExchangePathForProxy(proxyPath)}&bytes=${PEEK_BYTES}`;

    let xml: string;
    try {
      const r = await fetchWithRetry(proxyUrl, "*/*", exchangeProxyAuthHeaders(proxy.token));
      if (!r.ok) {
        const message = await readProxyErrorMessage(r);
        sendJson(res, r.status === 404 ? 404 : 502, {
          success: false,
          code: r.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR",
          message,
        });
        return;
      }
      xml = await r.text();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      sendJson(res, 502, {
        success: false,
        code: "UPSTREAM_UNREACHABLE",
        message: `VM proxy недоступен: ${m}`,
      });
      return;
    }

    let rows;
    try {
      rows = await parseExchangeStoresXml(xml);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      sendJson(res, 502, {
        success: false,
        code: "XML_PARSE_ERROR",
        message: `Ошибка разбора XML: ${m}`,
      });
      return;
    }

    const stats = await upsertExchangeStoresInBatches(pool, rows, sourceFile);
    const durationMs = Date.now() - started;
    console.info("[sync-exchange-stores]", {
      total: rows.length,
      inserted: stats.inserted,
      updated: stats.updated,
      unchanged: stats.unchanged,
      skipped_locked: stats.skipped_locked,
      durationMs,
    });

    sendJson(res, 200, {
      success: true,
      total: rows.length,
      inserted: stats.inserted,
      updated: stats.updated,
      unchanged: stats.unchanged,
      skipped_locked: stats.skipped_locked,
      durationMs,
      sourceFile,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[sync-exchange-stores]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
