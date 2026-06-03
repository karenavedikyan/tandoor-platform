/**
 * Showcase matrix API (Промт 150):
 *   GET  /api/showcase-matrix/list?tradePointId=&dealerId=
 *   GET  /api/showcase-matrix/history?tradePointId=&dealerId=&limit=
 *   POST /api/showcase-matrix/upsert
 *   POST /api/showcase-matrix/batch-sync
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
  handleShowcaseMatrixBatchSync,
  handleShowcaseMatrixHistory,
  handleShowcaseMatrixList,
  handleShowcaseMatrixUpsert,
  ShowcaseMatrixValidationError,
  type ShowcaseMatrixSessionUser,
} from "../../shared/showcase-matrix-handlers.js";

const SHOWCASE_MATRIX_ROLES = new Set([
  "admin",
  "director",
  "rop",
  "manager",
  "regional_manager",
]);

function parseQueryString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function parseQueryInt(raw: unknown): number | undefined {
  const s = parseQueryString(raw);
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function assertShowcaseMatrixRole(me: { role: string; status: string }): boolean {
  return me.status === "active" && SHOWCASE_MATRIX_ROLES.has(me.role);
}

function toSessionUser(me: {
  id: string;
  role: string;
  status: string;
  full_name: string;
}): ShowcaseMatrixSessionUser {
  return {
    id: me.id,
    role: me.role,
    status: me.status,
    fullName: me.full_name,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const actionRaw = req.query.action;
  const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

  try {
    if (req.method !== "GET" && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
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

    if (!assertShowcaseMatrixRole(me)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    const sessionUser = toSessionUser(me);
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (action === "list" && req.method === "GET") {
      const payload = await handleShowcaseMatrixList(pool, {
        tradePointId: parseQueryString(req.query.tradePointId),
        dealerId: parseQueryString(req.query.dealerId),
      });
      sendJson(res, 200, payload);
      return;
    }

    if (action === "history" && req.method === "GET") {
      const payload = await handleShowcaseMatrixHistory(pool, {
        tradePointId: parseQueryString(req.query.tradePointId),
        dealerId: parseQueryString(req.query.dealerId),
        limit: parseQueryInt(req.query.limit),
      });
      sendJson(res, 200, payload);
      return;
    }

    if (action === "upsert" && req.method === "POST") {
      const payload = await handleShowcaseMatrixUpsert(pool, sessionUser, body);
      sendJson(res, 200, payload);
      return;
    }

    if (action === "batch-sync" && req.method === "POST") {
      const payload = await handleShowcaseMatrixBatchSync(pool, sessionUser, body);
      sendJson(res, 200, payload);
      return;
    }

    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Метод не поддерживается." });
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут showcase-matrix." });
  } catch (e) {
    if (e instanceof ShowcaseMatrixValidationError) {
      sendJson(res, 400, { success: false, code: e.code, message: e.message });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[showcase-matrix-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
