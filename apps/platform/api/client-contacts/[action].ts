/**
 * Client contacts API (Промт 66):
 *   GET  /api/client-contacts/list?clientId=
 *   POST /api/client-contacts/create
 *   PATCH /api/client-contacts/patch
 *   POST /api/client-contacts/set-primary
 *   POST /api/client-contacts/request-delete
 *   POST /api/client-contacts/copy-to-scopes
 *   POST /api/client-contacts/bulk-import
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
  handleClientContactsBulkImport,
  handleClientContactsCopyToScopes,
  handleClientContactsCreate,
  handleClientContactsList,
  handleClientContactsPatch,
  handleClientContactsRequestDelete,
  handleClientContactsSetPrimary,
} from "../../shared/client-contacts-handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const actionRaw = req.query.action;
    const action = Array.isArray(actionRaw) ? String(actionRaw[0] ?? "") : String(actionRaw ?? "");

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

    const headers = vercelHeaders(req);
    const me = await resolveCurrentUser(pool, headers);
    if (!me) {
      sendJson(res, 401, { success: false, code: "UNAUTHENTICATED", message: "Требуется вход." });
      return;
    }

    const sessionUser = { id: me.id, role: me.role, status: me.status };

    if (action === "list" && req.method === "GET") {
      await handleClientContactsList(req, res, pool, sessionUser);
      return;
    }
    if (action === "create" && req.method === "POST") {
      await handleClientContactsCreate(req, res, pool, sessionUser);
      return;
    }
    if (action === "patch" && req.method === "PATCH") {
      await handleClientContactsPatch(req, res, pool, sessionUser);
      return;
    }
    if (action === "set-primary" && req.method === "POST") {
      await handleClientContactsSetPrimary(req, res, pool, sessionUser);
      return;
    }
    if (action === "request-delete" && req.method === "POST") {
      await handleClientContactsRequestDelete(req, res, pool, sessionUser);
      return;
    }
    if (action === "copy-to-scopes" && req.method === "POST") {
      await handleClientContactsCopyToScopes(req, res, pool, sessionUser);
      return;
    }
    if (action === "bulk-import" && req.method === "POST") {
      await handleClientContactsBulkImport(req, res, pool, sessionUser);
      return;
    }

    sendJson(res, 404, { success: false, code: "NOT_FOUND", message: "Неизвестный маршрут client-contacts." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[client-contacts-api] unhandled", m);
    sendJson(res, 500, { success: false, code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера." });
  }
}
