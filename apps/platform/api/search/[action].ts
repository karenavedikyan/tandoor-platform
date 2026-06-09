/**
 * GET /api/search/query?q=...&limitPerType=8
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { handleGlobalSearch } from "../../shared/search-handlers.js";

function parseQueryString(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function parseLimit(raw: unknown): number | undefined {
  if (typeof raw !== "string") return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const actionRaw = req.query.action;
  const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

    if (action !== "query") {
      sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут search." });
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

    const payload = await handleGlobalSearch(
      pool,
      { id: me.id, role: me.role, status: me.status },
      {
        query: parseQueryString(req.query.q),
        limitPerType: parseLimit(req.query.limitPerType),
      },
    );

    sendJson(res, 200, payload as unknown as Record<string, unknown>);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/search]", action, m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
