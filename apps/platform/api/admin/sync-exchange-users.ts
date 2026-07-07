/**
 * POST /api/admin/sync-exchange-users — триггер импорта employers1.xml на VM runner.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../../shared/admin/admin-auth.js";
import { exchangeProxyAuthHeaders, resolveExchangeProxyConfig } from "../../shared/admin/exchange-fetch.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
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

    const extraEnv: Record<string, string> = {};
    const dbUrl =
      process.env.DATABASE_URL_UNPOOLED?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_URL_NON_POOLING?.trim();
    if (dbUrl) extraEnv.DATABASE_URL_UNPOOLED = dbUrl;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...exchangeProxyAuthHeaders(proxy.token),
    };

    const r = await fetch(`${proxy.proxyUrl}/run/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({ extraEnv: Object.keys(extraEnv).length ? extraEnv : undefined }),
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      sendJson(res, r.status >= 400 && r.status < 600 ? r.status : 502, {
        success: false,
        code: String(json.code ?? "RUNNER_ERROR"),
        message: String(json.message ?? `Runner HTTP ${r.status}`),
        runner: json,
      });
      return;
    }

    sendJson(res, 202, {
      success: true,
      started: true,
      ranAt: new Date().toISOString(),
      message: "Импорт сотрудников 1С запущен на VM",
      runner: json,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[sync-exchange-users]", m);
    sendJson(res, 502, { success: false, code: "UPSTREAM_UNREACHABLE", message: `VM proxy недоступен: ${m}` });
  }
}
