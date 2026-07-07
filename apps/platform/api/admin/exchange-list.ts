/**
 * GET /api/admin/exchange-list?path=/
 * Читает HTTPS-листинг директории обмена 1С через Yandex VM-прокси (s3.toopatch.ru).
 * Только для роли admin.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import {
  EXCHANGE_S3_BASE,
  exchangeProxyAuthHeaders,
  fetchWithRetry,
  resolveExchangeProxyConfig,
} from "../../shared/admin/exchange-fetch.js";

export type ExchangeListItem = {
  name: string;
  type: "directory" | "file";
  href: string;
  sizeText: string | null;
  modifiedText: string | null;
};

export function parseExchangeListing(html: string, baseHref: string): ExchangeListItem[] {
  const items: ExchangeListItem[] = [];
  const rowRe = /(?:<br>|^)([^<]*?)<A HREF="([^"]+)">([^<]+)<\/A>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const meta = (m[1] ?? "").trim();
    const href = m[2] ?? "";
    const name = m[3] ?? "";
    if (name === "[To Parent Directory]" || href === baseHref) continue;
    const isDir = /&lt;dir&gt;/i.test(meta) || href.endsWith("/");
    let sizeText: string | null = null;
    let modifiedText: string | null = null;
    if (!isDir) {
      const sizeMatch = meta.match(/(\d+)\s*$/);
      if (sizeMatch) sizeText = sizeMatch[1];
      const modMatch = meta.match(/^([A-Za-z]{3},\s+\d+\s+[A-Za-z]{3}\s+\d+\s+\d+:\d+:\d+\s+GMT)/);
      if (modMatch) modifiedText = modMatch[1];
    } else {
      const modMatch = meta.match(/(\d+:\d+)/);
      if (modMatch) modifiedText = modMatch[1];
    }
    items.push({ name, type: isDir ? "directory" : "file", href, sizeText, modifiedText });
  }
  return items;
}

function listingUrlForPath(rawPath: string): string {
  return `${EXCHANGE_S3_BASE}${rawPath === "/" ? "/" : rawPath.replace(/\/?$/, "/")}`;
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
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
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

    const rawPath = String(req.query.path ?? "/").trim();
    if (!rawPath.startsWith("/") || rawPath.length > 200 || rawPath.includes("..")) {
      sendJson(res, 400, { success: false, code: "BAD_PATH", message: "Некорректный путь." });
      return;
    }

    const s3Url = listingUrlForPath(rawPath);
    const proxyUrl = `${proxy.proxyUrl}/exchange/list?path=${encodeURIComponent(rawPath)}`;
    let html: string;
    try {
      const r = await fetchWithRetry(
        proxyUrl,
        "text/html,application/xhtml+xml",
        exchangeProxyAuthHeaders(proxy.token),
      );
      if (!r.ok) {
        const message = await readProxyErrorMessage(r);
        sendJson(res, r.status === 404 ? 404 : 502, {
          success: false,
          code: r.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR",
          message,
          url: s3Url,
        });
        return;
      }
      html = await r.text();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      sendJson(res, 502, {
        success: false,
        code: "UPSTREAM_UNREACHABLE",
        message: `VM proxy недоступен: ${m}`,
        url: s3Url,
      });
      return;
    }

    const baseHref = `/images/IMG/exchange${rawPath === "/" ? "/" : rawPath.replace(/\/?$/, "/")}`;
    const items = parseExchangeListing(html, baseHref);
    sendJson(res, 200, {
      success: true,
      base: EXCHANGE_S3_BASE,
      path: rawPath,
      url: s3Url,
      count: items.length,
      items,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[exchange-list]", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: m });
  }
}
