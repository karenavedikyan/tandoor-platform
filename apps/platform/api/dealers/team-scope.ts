/**
 * GET /api/dealers/team-scope — scope команды РОП из БД (Промт 423).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, resolveCurrentUser, sendJson, vercelHeaders } from "../../shared/admin/admin-auth.js";
import { fetchTeamScopeForRequest } from "../../shared/dealers-team-scope-handlers.js";
import type { UserRole } from "../../shared/auth.js";

function parseRopUserId(req: VercelRequest): string | undefined {
  const raw = req.query.ropUserId ?? req.query.rop_user_id;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = typeof s === "string" ? s.trim() : "";
  return trimmed || undefined;
}

function parseTotalsOnly(req: VercelRequest): boolean {
  const raw = req.query.totalsOnly;
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s === "1" || s === "true";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Только GET." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 503, {
        success: false,
        code: "DB_UNAVAILABLE",
        message: "База данных недоступна.",
      });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const viewer = {
      id: me.id,
      email: me.email,
      role: me.role as UserRole,
      full_name: me.full_name,
    };

    const result = await fetchTeamScopeForRequest(pool, viewer, parseRopUserId(req), {
      totalsOnly: parseTotalsOnly(req),
    });
    if ("forbidden" in result) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав для просмотра scope команды." });
      return;
    }
    if ("notFound" in result) {
      sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Команда не найдена." });
      return;
    }

    sendJson(res, 200, result as unknown as Record<string, unknown>);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[api/dealers/team-scope]", m.slice(0, 200));
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
