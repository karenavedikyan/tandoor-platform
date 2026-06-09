/**
 * Showcase install assignments API (Промт 228) — задания на отгрузку моделей на витрину.
 *   POST /api/showcase-assignments/create
 *   GET  /api/showcase-assignments/get?id=
 *   GET  /api/showcase-assignments/list?tradePointId=&dealerId=&status=&mine=1
 *   POST /api/showcase-assignments/item-toggle   { assignmentId, itemId, done }
 *   POST /api/showcase-assignments/item-set-status { assignmentId, itemId, itemStatus, ... }
 *   POST /api/showcase-assignments/submit         { assignmentId }
 *   POST /api/showcase-assignments/verify         { assignmentId, itemIds? }
 *   POST /api/showcase-assignments/followup       { assignmentId, comment?, dueDate? }
 *   POST /api/showcase-assignments/close          { assignmentId }
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
  AssignmentValidationError,
  handleAddComment,
  handleArchive,
  handleClose,
  handleCreate,
  handleDelete,
  handleFollowup,
  handleGet,
  handleItemSetStatus,
  handleItemToggle,
  handleList,
  handleListComments,
  handleRemind,
  handleSubmit,
  handleUnarchive,
  handleUpdate,
  handleVerify,
  type AssignmentSessionUser,
} from "../../shared/showcase-assignments-handlers.js";

const ASSIGNMENT_ROLES = new Set(["admin", "director", "rop", "regional_manager", "manager"]);

function parseQueryString(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function toSessionUser(me: { id: string; role: string; status: string; full_name: string }): AssignmentSessionUser {
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
    if (me.status !== "active" || !ASSIGNMENT_ROLES.has(me.role)) {
      sendJson(res, 403, { success: false, code: "FORBIDDEN", message: "Недостаточно прав." });
      return;
    }

    const sessionUser = toSessionUser(me);
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (action === "get" && req.method === "GET") {
      sendJson(res, 200, await handleGet(pool, sessionUser, parseQueryString(req.query.id)));
      return;
    }

    if (action === "list" && req.method === "GET") {
      sendJson(res, 200, await handleList(pool, sessionUser, {
        tradePointId: parseQueryString(req.query.tradePointId),
        dealerId: parseQueryString(req.query.dealerId),
        assigneeUserId: parseQueryString(req.query.assigneeUserId),
        createdBy: parseQueryString(req.query.createdBy),
        status: parseQueryString(req.query.status),
        mine: parseQueryString(req.query.mine) === "1",
        includeArchived: parseQueryString(req.query.includeArchived) === "1",
        archivedOnly: parseQueryString(req.query.archivedOnly) === "1",
      }));
      return;
    }

    if (action === "comments" && req.method === "GET") {
      sendJson(res, 200, await handleListComments(pool, sessionUser, parseQueryString(req.query.assignmentId)));
      return;
    }

    if (req.method === "POST") {
      if (action === "create") { sendJson(res, 200, await handleCreate(pool, sessionUser, body)); return; }
      if (action === "item-toggle") { sendJson(res, 200, await handleItemToggle(pool, sessionUser, body)); return; }
      if (action === "item-set-status") { sendJson(res, 200, await handleItemSetStatus(pool, sessionUser, body)); return; }
      if (action === "submit") { sendJson(res, 200, await handleSubmit(pool, sessionUser, body)); return; }
      if (action === "verify") { sendJson(res, 200, await handleVerify(pool, sessionUser, body)); return; }
      if (action === "followup") { sendJson(res, 200, await handleFollowup(pool, sessionUser, body)); return; }
      if (action === "close") { sendJson(res, 200, await handleClose(pool, sessionUser, body)); return; }
      if (action === "update") { sendJson(res, 200, await handleUpdate(pool, sessionUser, body)); return; }
      if (action === "archive") { sendJson(res, 200, await handleArchive(pool, sessionUser, body)); return; }
      if (action === "unarchive") { sendJson(res, 200, await handleUnarchive(pool, sessionUser, body)); return; }
      if (action === "delete") { sendJson(res, 200, await handleDelete(pool, sessionUser, body)); return; }
      if (action === "remind") { sendJson(res, 200, await handleRemind(pool, sessionUser, body)); return; }
      if (action === "add-comment") { sendJson(res, 200, await handleAddComment(pool, sessionUser, body)); return; }
    }

    if (req.method !== "GET" && req.method !== "POST") {
      sendJson(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "Метод не поддерживается." });
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут showcase-assignments." });
  } catch (e) {
    if (e instanceof AssignmentValidationError) {
      const status = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
      sendJson(res, status, { success: false, code: e.code, message: e.message });
      return;
    }
    const m = e instanceof Error ? e.message : String(e);
    console.error("[showcase-assignments-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
