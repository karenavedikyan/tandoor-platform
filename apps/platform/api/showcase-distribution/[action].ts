/**
 * Showcase distribution API (Промт 426).
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
  handleShowcaseDistributionGlobalTasks,
  handleShowcaseDistributionImport,
  handleShowcaseDistributionOverride,
  handleShowcaseDistributionRecommendation,
  handleShowcaseDistributionState,
  handleShowcaseDistributionTaskComplete,
  handleShowcaseDistributionTaskStatus,
  ShowcaseDistributionForbiddenError,
  ShowcaseDistributionValidationError,
  type ShowcaseDistributionSessionUser,
} from "../../shared/showcase-distribution-handlers.js";

const ROLES = new Set([
  "admin",
  "director",
  "rop",
  "manager",
  "regional_manager",
  "analyst",
  "marketer",
  "category_manager",
]);

function parseQueryString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function toSessionUser(me: { id: string; role: string; status: string; full_name: string }): ShowcaseDistributionSessionUser {
  return { id: me.id, role: me.role, status: me.status, fullName: me.full_name };
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
      sendJson(res, 503, { success: false, code: "DB_UNAVAILABLE", message: "База данных недоступна." });
      return;
    }

    const me = await resolveCurrentUser(pool, vercelHeaders(req));
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    if (me.status !== "active" || !ROLES.has(me.role)) {
      sendJson(res, 403, { success: false, error: "forbidden", reason: "Недостаточно прав." });
      return;
    }

    const sessionUser = toSessionUser(me);
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (action === "state" && req.method === "GET") {
      const dealerId = parseQueryString(req.query.dealerId);
      if (!dealerId) {
        sendJson(res, 400, { success: false, code: "VALIDATION_ERROR", message: "Укажите dealerId." });
        return;
      }
      const payload = await handleShowcaseDistributionState(pool, sessionUser, dealerId);
      sendJson(res, 200, payload);
      return;
    }

    if (action === "global-tasks" && req.method === "GET") {
      const payload = await handleShowcaseDistributionGlobalTasks(pool, sessionUser);
      sendJson(res, 200, payload);
      return;
    }

    if (action === "task-complete" && req.method === "POST") {
      const payload = await handleShowcaseDistributionTaskComplete(pool, sessionUser, body);
      sendJson(res, 200, payload);
      return;
    }

    if (action === "task-status" && req.method === "POST") {
      const payload = await handleShowcaseDistributionTaskStatus(pool, sessionUser, body);
      sendJson(res, 200, payload);
      return;
    }

    if (action === "recommendation" && req.method === "POST") {
      const payload = await handleShowcaseDistributionRecommendation(pool, sessionUser, body);
      if ("conflict" in payload && payload.conflict) {
        sendJson(res, 409, { success: false, code: "CONFLICT", message: payload.message });
        return;
      }
      sendJson(res, 200, payload);
      return;
    }

    if (action === "override" && req.method === "POST") {
      const payload = await handleShowcaseDistributionOverride(pool, sessionUser, body);
      sendJson(res, 200, payload);
      return;
    }

    if (action === "import" && req.method === "POST") {
      const payload = await handleShowcaseDistributionImport(pool, sessionUser, body);
      sendJson(res, 200, payload);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут showcase-distribution." });
  } catch (e) {
    if (e instanceof ShowcaseDistributionValidationError) {
      sendJson(res, 400, { success: false, code: e.code, message: e.message });
      return;
    }
    if (e instanceof ShowcaseDistributionForbiddenError) {
      sendJson(res, 403, { success: false, error: "forbidden", reason: e.reason });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[showcase-distribution-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
