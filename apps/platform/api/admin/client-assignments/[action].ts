/**
 * Vercel Serverless: client-assignments admin endpoints.
 *
 * Действия:
 *   POST /api/admin/client-assignments/clients-reassign
 *   POST /api/admin/client-assignments/user-team-reassign
 *   GET  /api/admin/client-assignments/clients-assignments-list
 *   GET  /api/admin/client-assignments/client-assignment-history
 *   GET  /api/admin/client-assignments/user-team-history
 *
 * Изолировано от `api/admin/[action].ts`, чтобы не раздувать главный admin-бандл.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  enforceCsrfOrigin,
  getPool,
  resolveCurrentUser,
  sendJson,
  vercelHeaders,
} from "../_handlers/admin-auth";
import {
  handleClientAssignmentHistory,
  handleClientsAssignmentsList,
  handleClientsReassign,
  handleUserTeamHistory,
  handleUserTeamReassign,
} from "../_handlers/client-assignments-handlers";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

    if (req.method === "POST" && !enforceCsrfOrigin(req)) {
      sendJson(res, 403, { success: false, code: "CSRF_REJECTED", message: "Недопустимый источник запроса." });
      return;
    }

    const pool = getPool();
    if (!pool) {
      sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
      return;
    }
    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    if (action === "clients-reassign" && req.method === "POST") {
      await handleClientsReassign(req, res, pool, me);
      return;
    }
    if (action === "user-team-reassign" && req.method === "POST") {
      await handleUserTeamReassign(req, res, pool, me);
      return;
    }
    if (action === "clients-assignments-list" && req.method === "GET") {
      await handleClientsAssignmentsList(req, res, pool, me);
      return;
    }
    if (action === "client-assignment-history" && req.method === "GET") {
      await handleClientAssignmentHistory(req, res, pool, me);
      return;
    }
    if (action === "user-team-history" && req.method === "GET") {
      await handleUserTeamHistory(req, res, pool, me);
      return;
    }

    sendJson(res, 404, {
      success: false,
      code: "NOT_FOUND",
      message: "Неизвестный маршрут client-assignments.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[client-assignments-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
